import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EntityManager } from 'typeorm';
import { ATTENDANCE_CORRECTION_REPOSITORY, ATTENDANCE_REPOSITORY, ATTENDANCE_CHECKED_IN_EVENT } from './attendance.constants';
import { IAttendanceRepository, PaginatedResult } from './attendance-repository.interface';
import { IAttendanceCorrectionRepository } from './attendance-correction-repository.interface';
import { EMPLOYEE_REPOSITORY } from '../employee/employee.constants';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { Employee } from '../employee/entities/employee.entity';
import { TRANSACTION_RUNNER, TransactionRunner } from '../../database/transaction-runner';
import { GeofenceValidationStrategy } from './strategies/geofence-validation.strategy';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { AttendanceCorrection, AttendanceCorrectionStatus } from './entities/attendance-correction.entity';
import { Shift } from '../../database/entities/shift.entity';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { FindAttendanceHistoryQueryDto } from './dto/find-attendance-history-query.dto';
import { AttendanceCheckedInEvent } from './events/attendance-checked-in.event';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../../common/enums/user-role.enum';
import { combineDateAndTimeUtc, formatDateOnly } from '../../common/utils/date.util';
import { LEAVE_APPROVED_EVENT, LEAVE_CANCELLED_EVENT } from '../leave/leave.constants';
import { LeaveApprovedEvent } from '../leave/events/leave-approved.event';
import { LeaveCancelledEvent } from '../leave/events/leave-cancelled.event';
import { AuditLogService } from '../../common/services/audit-log.service';

/**
 * Logika bisnis modul Attendance — roadmap-aplikasi-hr.md Phase 2, alur
 * check-in di backend-architecture-hr.md §6:
 * "Controller (validasi DTO) -> AttendanceService -> GeofenceStrategy.validate
 * -> jika valid: AttendanceRepository.save() -> EventEmitter('attendance.checked_in')
 * -> NotificationService (async)".
 *
 * Bergantung pada interface repository (Dependency Inversion, §3) sehingga
 * bisa di-unit-test dengan mock repository, tanpa DB/HTTP server sungguhan.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  private readonly maxGpsAccuracyMeters: number;
  private readonly maxClockSkewSeconds: number;

  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendanceRepository: IAttendanceRepository,
    @Inject(ATTENDANCE_CORRECTION_REPOSITORY)
    private readonly correctionRepository: IAttendanceCorrectionRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactionRunner: TransactionRunner,
    private readonly geofenceStrategy: GeofenceValidationStrategy,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: AuditLogService,
    configService: ConfigService,
  ) {
    this.maxGpsAccuracyMeters = configService.get<number>('attendance.maxGpsAccuracyMeters') as number;
    this.maxClockSkewSeconds = configService.get<number>('attendance.maxClockSkewSeconds') as number;
  }

  async checkIn(userId: string, dto: CheckInDto): Promise<Attendance> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const now = new Date();

    this.assertClockNotSkewed(dto.deviceTimestamp, now);
    this.assertGpsAccuracyAcceptable(dto.accuracyMeters);

    const geofenceResult = this.geofenceStrategy.validate(
      { latitude: dto.latitude, longitude: dto.longitude },
      {
        latitude: Number(employee.branch.latitude),
        longitude: Number(employee.branch.longitude),
        radiusMeters: employee.branch.radiusMeters,
      },
    );
    if (!geofenceResult.isWithinRadius) {
      throw new ForbiddenException({
        errorCode: 'ATTENDANCE_OUT_OF_RADIUS',
        message: 'Anda berada di luar radius kantor',
        details: { distanceMeters: geofenceResult.distanceMeters },
      });
    }

    const attendanceDate = formatDateOnly(now);
    const existing = await this.attendanceRepository.findByEmployeeAndDate(employee.id, attendanceDate);
    if (existing?.checkInTime) {
      throw new ConflictException('Anda sudah melakukan check-in hari ini');
    }

    const shiftAssignment = await this.attendanceRepository.findActiveShiftAssignment(
      employee.id,
      attendanceDate,
    );
    if (!shiftAssignment) {
      throw new NotFoundException('Jadwal shift tidak ditemukan untuk tanggal ini');
    }

    const status = this.determineCheckInStatus(shiftAssignment.shift, now, attendanceDate);
    const checkInData = {
      employeeId: employee.id,
      branchId: employee.branchId,
      shiftId: shiftAssignment.shiftId,
      attendanceDate,
      checkInTime: now,
      checkInLat: dto.latitude.toString(),
      checkInLng: dto.longitude.toString(),
      checkInDistanceMeters: geofenceResult.distanceMeters.toFixed(2),
      checkInPhotoUrl: dto.photoUrl ?? null,
      status,
    };

    const attendance = existing
      ? await this.attendanceRepository.update(existing.id, checkInData)
      : await this.attendanceRepository.create(checkInData);

    this.eventEmitter.emit(
      ATTENDANCE_CHECKED_IN_EVENT,
      new AttendanceCheckedInEvent(attendance.id, employee.id, userId, now, status),
    );

    return attendance;
  }

  async checkOut(userId: string, dto: CheckOutDto): Promise<Attendance> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const now = new Date();

    this.assertClockNotSkewed(dto.deviceTimestamp, now);
    this.assertGpsAccuracyAcceptable(dto.accuracyMeters);

    const geofenceResult = this.geofenceStrategy.validate(
      { latitude: dto.latitude, longitude: dto.longitude },
      {
        latitude: Number(employee.branch.latitude),
        longitude: Number(employee.branch.longitude),
        radiusMeters: employee.branch.radiusMeters,
      },
    );
    if (!geofenceResult.isWithinRadius) {
      throw new ForbiddenException({
        errorCode: 'ATTENDANCE_OUT_OF_RADIUS',
        message: 'Anda berada di luar radius kantor',
        details: { distanceMeters: geofenceResult.distanceMeters },
      });
    }

    const attendanceDate = formatDateOnly(now);
    const attendance = await this.attendanceRepository.findByEmployeeAndDate(employee.id, attendanceDate);
    if (!attendance?.checkInTime) {
      throw new NotFoundException('Anda belum melakukan check-in hari ini');
    }
    if (attendance.checkOutTime) {
      throw new ConflictException('Anda sudah melakukan check-out hari ini');
    }

    const status = this.determineCheckOutStatus(attendance.status, attendance.shift, now, attendanceDate);

    return this.attendanceRepository.update(attendance.id, {
      checkOutTime: now,
      checkOutLat: dto.latitude.toString(),
      checkOutLng: dto.longitude.toString(),
      checkOutDistanceMeters: geofenceResult.distanceMeters.toFixed(2),
      workDurationMinutes: this.calculateWorkDurationMinutes(attendance.checkInTime, now),
      status,
    });
  }

  async findHistory(
    userId: string,
    query: FindAttendanceHistoryQueryDto,
  ): Promise<PaginatedResult<Attendance> & { page: number; limit: number }> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const { items, total } = await this.attendanceRepository.findHistory({
      employeeId: employee.id,
      page,
      limit,
      month: query.month,
      year: query.year,
    });

    return { items, total, page, limit };
  }

  async requestCorrection(
    userId: string,
    dto: CreateAttendanceCorrectionDto,
  ): Promise<AttendanceCorrection> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const existingAttendance = await this.attendanceRepository.findByEmployeeAndDate(
      employee.id,
      dto.requestedDate,
    );

    return this.correctionRepository.create({
      attendanceId: existingAttendance?.id ?? null,
      employeeId: employee.id,
      requestedDate: dto.requestedDate,
      reason: dto.reason,
      requestedCheckIn: dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : null,
      requestedCheckOut: dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : null,
      status: AttendanceCorrectionStatus.PENDING,
    });
  }

  async approveCorrection(actingUser: AuthenticatedUser, correctionId: string): Promise<AttendanceCorrection> {
    const { correction, targetEmployee, actingEmployee } = await this.loadCorrectionForDecision(
      actingUser,
      correctionId,
    );

    if (!correction.attendanceId && !correction.requestedCheckIn) {
      throw new BadRequestException(
        'requestedCheckIn wajib diisi untuk mengoreksi hari yang belum punya data absen',
      );
    }

    return this.transactionRunner.run(async (manager) => {
      await this.applyCorrectionToAttendance(correction, targetEmployee, manager);

      const updated = await this.correctionRepository.update(
        correction.id,
        {
          status: AttendanceCorrectionStatus.APPROVED,
          approvedBy: actingEmployee.id,
          approvedAt: new Date(),
        },
        manager,
      );

      // Checklist §7: "Ada audit log untuk perubahan data ... approval".
      await this.auditLogService.record(
        {
          userId: actingUser.userId,
          action: 'APPROVE_ATTENDANCE_CORRECTION',
          entityType: 'attendance_correction',
          entityId: correction.id,
          oldValue: { status: AttendanceCorrectionStatus.PENDING },
          newValue: { status: AttendanceCorrectionStatus.APPROVED, approvedBy: actingEmployee.id },
        },
        manager,
      );

      return updated;
    });
  }

  async rejectCorrection(actingUser: AuthenticatedUser, correctionId: string): Promise<AttendanceCorrection> {
    const { correction, actingEmployee } = await this.loadCorrectionForDecision(actingUser, correctionId);

    // attendance_corrections + audit_logs — dua tabel, dibungkus satu
    // transaction (checklist §7: "Semua operasi multi-tabel dibungkus
    // transaction").
    return this.transactionRunner.run(async (manager) => {
      const updated = await this.correctionRepository.update(
        correction.id,
        {
          status: AttendanceCorrectionStatus.REJECTED,
          approvedBy: actingEmployee.id,
          approvedAt: new Date(),
        },
        manager,
      );

      await this.auditLogService.record(
        {
          userId: actingUser.userId,
          action: 'REJECT_ATTENDANCE_CORRECTION',
          entityType: 'attendance_correction',
          entityId: correction.id,
          oldValue: { status: AttendanceCorrectionStatus.PENDING },
          newValue: { status: AttendanceCorrectionStatus.REJECTED, approvedBy: actingEmployee.id },
        },
        manager,
      );

      return updated;
    });
  }

  // ---------------------------------------------------------------------
  // Helper privat
  // ---------------------------------------------------------------------

  private async getEmployeeByUserIdOrThrow(userId: string): Promise<Employee> {
    const employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('Data karyawan tidak ditemukan untuk akun ini');
    }
    return employee;
  }

  /**
   * Deteksi anomali dasar (§6): tolak jika jam perangkat menyimpang terlalu
   * jauh dari jam server — indikasi jam device diubah manual untuk mengakali
   * status keterlambatan. Waktu yang benar-benar DISIMPAN selalu waktu
   * server (`now`), bukan `deviceTimestamp` — field ini murni untuk deteksi.
   */
  private assertClockNotSkewed(deviceTimestamp: string, serverNow: Date): void {
    const driftSeconds = Math.abs((serverNow.getTime() - new Date(deviceTimestamp).getTime()) / 1000);
    if (driftSeconds > this.maxClockSkewSeconds) {
      throw new BadRequestException({
        errorCode: 'ATTENDANCE_CLOCK_MISMATCH',
        message: 'Waktu perangkat tidak sesuai dengan waktu server',
        details: { driftSeconds: Math.round(driftSeconds) },
      });
    }
  }

  /** roadmap Phase 2 "Detail Teknis Radius": tolak akurasi GPS yang buruk. */
  private assertGpsAccuracyAcceptable(accuracyMeters?: number): void {
    if (accuracyMeters !== undefined && accuracyMeters > this.maxGpsAccuracyMeters) {
      throw new BadRequestException({
        errorCode: 'ATTENDANCE_LOW_GPS_ACCURACY',
        message: 'Akurasi GPS terlalu rendah, coba lagi di area terbuka',
        details: { accuracyMeters },
      });
    }
  }

  private determineCheckInStatus(shift: Shift, checkInTime: Date, attendanceDate: string): AttendanceStatus {
    const shiftStartWithTolerance = combineDateAndTimeUtc(attendanceDate, shift.startTime);
    shiftStartWithTolerance.setUTCMinutes(shiftStartWithTolerance.getUTCMinutes() + shift.toleranceMinutes);
    return checkInTime > shiftStartWithTolerance ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
  }

  private determineCheckOutStatus(
    currentStatus: AttendanceStatus,
    shift: Shift,
    checkOutTime: Date,
    attendanceDate: string,
  ): AttendanceStatus {
    if (currentStatus === AttendanceStatus.LATE) {
      return currentStatus;
    }
    const shiftEndWithTolerance = combineDateAndTimeUtc(attendanceDate, shift.endTime);
    shiftEndWithTolerance.setUTCMinutes(shiftEndWithTolerance.getUTCMinutes() - shift.toleranceMinutes);
    return checkOutTime < shiftEndWithTolerance ? AttendanceStatus.EARLY_LEAVE : currentStatus;
  }

  private calculateWorkDurationMinutes(checkIn?: Date | null, checkOut?: Date | null): number | null {
    if (!checkIn || !checkOut) return null;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
  }

  private async loadCorrectionForDecision(
    actingUser: AuthenticatedUser,
    correctionId: string,
  ): Promise<{ correction: AttendanceCorrection; targetEmployee: Employee; actingEmployee: Employee }> {
    const correction = await this.correctionRepository.findById(correctionId);
    if (!correction) {
      throw new NotFoundException('Pengajuan koreksi tidak ditemukan');
    }
    if (correction.status !== AttendanceCorrectionStatus.PENDING) {
      throw new ConflictException('Pengajuan koreksi sudah diproses');
    }

    const [targetEmployee, actingEmployee] = await Promise.all([
      this.employeeRepository.findById(correction.employeeId),
      this.employeeRepository.findByUserId(actingUser.userId),
    ]);
    if (!targetEmployee) {
      throw new NotFoundException('Data karyawan pengaju tidak ditemukan');
    }
    if (!actingEmployee) {
      throw new NotFoundException('Data karyawan approver tidak ditemukan');
    }

    const isHrOrAbove = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN].includes(actingUser.role);
    const isDirectManager = targetEmployee.managerId === actingEmployee.id;
    if (!isHrOrAbove && !isDirectManager) {
      throw new ForbiddenException('Anda bukan atasan langsung karyawan ini');
    }

    return { correction, targetEmployee, actingEmployee };
  }

  private async applyCorrectionToAttendance(
    correction: AttendanceCorrection,
    targetEmployee: Employee,
    manager: EntityManager,
  ): Promise<void> {
    if (correction.attendanceId) {
      const existing = await this.attendanceRepository.findById(correction.attendanceId);
      if (!existing) {
        throw new NotFoundException('Data absensi terkait tidak ditemukan');
      }

      const finalCheckIn = correction.requestedCheckIn ?? existing.checkInTime;
      const finalCheckOut = correction.requestedCheckOut ?? existing.checkOutTime;

      await this.attendanceRepository.update(
        existing.id,
        {
          checkInTime: finalCheckIn,
          checkOutTime: finalCheckOut,
          workDurationMinutes: this.calculateWorkDurationMinutes(finalCheckIn, finalCheckOut),
          status:
            existing.status === AttendanceStatus.ABSENT && finalCheckIn
              ? AttendanceStatus.ON_TIME
              : existing.status,
        },
        manager,
      );
      return;
    }

    const shiftAssignment = await this.attendanceRepository.findActiveShiftAssignment(
      targetEmployee.id,
      correction.requestedDate,
    );
    if (!shiftAssignment) {
      throw new NotFoundException('Jadwal shift tidak ditemukan untuk tanggal koreksi');
    }

    await this.attendanceRepository.create(
      {
        employeeId: targetEmployee.id,
        branchId: targetEmployee.branchId,
        shiftId: shiftAssignment.shiftId,
        attendanceDate: correction.requestedDate,
        checkInTime: correction.requestedCheckIn,
        checkOutTime: correction.requestedCheckOut,
        workDurationMinutes: this.calculateWorkDurationMinutes(
          correction.requestedCheckIn,
          correction.requestedCheckOut,
        ),
        // Koreksi manual yang disetujui HR/atasan — anggap tepat waktu
        // (bukan hasil validasi geofence/jam shift otomatis).
        status: AttendanceStatus.ON_TIME,
      },
      manager,
    );
  }

  // ---------------------------------------------------------------------
  // Observer/Event-driven — integrasi dengan modul Leave (§3 & §6:
  // "setelah cuti disetujui -> update saldo & kalender tim"). AttendanceService
  // TIDAK bergantung pada LeaveService — hanya mendengarkan event, sama
  // seperti NotificationService mendengarkan 'attendance.checked_in'.
  // ---------------------------------------------------------------------

  @OnEvent(LEAVE_APPROVED_EVENT)
  async handleLeaveApproved(event: LeaveApprovedEvent): Promise<void> {
    try {
      const employee = await this.employeeRepository.findById(event.employeeId);
      if (!employee) return;

      for (const date of event.dates) {
        await this.markDateOnLeave(employee, date);
      }
    } catch (error) {
      // Sama seperti NotificationService: kegagalan di sini tidak boleh
      // menggagalkan approval cuti yang sudah tercatat di modul Leave.
      this.logger.error('Gagal menandai attendance ON_LEAVE setelah cuti disetujui', error as Error);
    }
  }

  @OnEvent(LEAVE_CANCELLED_EVENT)
  async handleLeaveCancelled(event: LeaveCancelledEvent): Promise<void> {
    try {
      for (const date of event.dates) {
        await this.revertDateOnLeave(event.employeeId, date);
      }
    } catch (error) {
      this.logger.error('Gagal membatalkan tanda ON_LEAVE setelah cuti dibatalkan', error as Error);
    }
  }

  /**
   * Tandai satu tanggal sebagai ON_LEAVE (bukan ABSENT) — roadmap Phase 3:
   * "Integrasi otomatis ke absensi (hari cuti tidak dihitung alpha)".
   * Dilewati jika karyawan sudah benar-benar check-in di tanggal itu (data
   * kehadiran nyata tidak boleh ditimpa) atau tidak ada jadwal shift pada
   * tanggal tersebut (bukan hari kerja).
   */
  private async markDateOnLeave(employee: Employee, date: string): Promise<void> {
    const existing = await this.attendanceRepository.findByEmployeeAndDate(employee.id, date);
    if (existing?.checkInTime) return;

    if (existing) {
      await this.attendanceRepository.update(existing.id, { status: AttendanceStatus.ON_LEAVE });
      return;
    }

    const shiftAssignment = await this.attendanceRepository.findActiveShiftAssignment(employee.id, date);
    if (!shiftAssignment) return;

    await this.attendanceRepository.create({
      employeeId: employee.id,
      branchId: employee.branchId,
      shiftId: shiftAssignment.shiftId,
      attendanceDate: date,
      status: AttendanceStatus.ON_LEAVE,
    });
  }

  /**
   * Kebalikan dari `markDateOnLeave` saat pengajuan cuti yang sudah
   * APPROVED dibatalkan. Hanya menyentuh baris yang murni hasil tanda
   * ON_LEAVE otomatis (belum ada check-in sungguhan) — kembali ke ABSENT,
   * baseline "belum ada data kehadiran" yang sama dipakai di
   * `applyCorrectionToAttendance`.
   */
  private async revertDateOnLeave(employeeId: string, date: string): Promise<void> {
    const existing = await this.attendanceRepository.findByEmployeeAndDate(employeeId, date);
    if (!existing || existing.status !== AttendanceStatus.ON_LEAVE || existing.checkInTime) return;

    await this.attendanceRepository.update(existing.id, { status: AttendanceStatus.ABSENT });
  }
}
