import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { AttendanceService } from './attendance.service';
import { IAttendanceRepository } from './attendance-repository.interface';
import { IAttendanceCorrectionRepository } from './attendance-correction-repository.interface';
import { IOvertimeRequestRepository } from './overtime-request-repository.interface';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { TransactionRunner } from '../../database/transaction-runner';
import { GeofenceValidationStrategy } from './strategies/geofence-validation.strategy';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { AttendanceCorrection, AttendanceCorrectionStatus } from './entities/attendance-correction.entity';
import { OvertimeRequest, OvertimeRequestStatus } from './entities/overtime-request.entity';
import { Employee } from '../employee/entities/employee.entity';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { ATTENDANCE_CHECKED_IN_EVENT } from './attendance.constants';
import { AuditLogService } from '../../common/services/audit-log.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepository: jest.Mocked<IAttendanceRepository>;
  let correctionRepository: jest.Mocked<IAttendanceCorrectionRepository>;
  let overtimeRequestRepository: jest.Mocked<IOvertimeRequestRepository>;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;
  let transactionRunner: TransactionRunner;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditLogService: jest.Mocked<AuditLogService>;

  // Kantor: titik acuan geofence. Tepat di titik ini => jarak 0m (dalam radius).
  const branch = { id: 'branch-1', latitude: '-6.1750000', longitude: '106.8270000', radiusMeters: 100 };
  // ~1.1km dari kantor => pasti di luar radius 100m.
  const farPoint = { latitude: -6.1650000, longitude: 106.8270000 };
  const officeLat = Number(branch.latitude);
  const officeLng = Number(branch.longitude);

  const employee = {
    id: 'employee-1',
    userId: 'user-1',
    branchId: branch.id,
    branch,
    managerId: 'manager-employee-1',
  } as unknown as Employee;

  const shiftAssignment = {
    shiftId: 'shift-1',
    shift: { id: 'shift-1', startTime: '08:00:00', endTime: '17:00:00', toleranceMinutes: 15 },
  } as unknown as EmployeeShiftAssignment;

  beforeEach(() => {
    attendanceRepository = {
      findByEmployeeAndDate: jest.fn(),
      findById: jest.fn(),
      findHistory: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findActiveShiftAssignment: jest.fn(),
      countStatusesByEmployee: jest.fn(),
      findShiftAssignmentsByEmployee: jest.fn(),
      findOpenShiftAssignment: jest.fn(),
      createShiftAssignment: jest.fn(),
      closeShiftAssignment: jest.fn(),
    };

    correctionRepository = {
      findById: jest.fn(),
      findByStatus: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    overtimeRequestRepository = {
      findById: jest.fn(),
      findByStatus: jest.fn(),
      findApprovedByEmployeeAndDateRange: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    employeeRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeCode: jest.fn(),
      findFirstByCompanyAndRole: jest.fn(),
      findActiveByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const runMock = jest.fn((work: (manager: never) => Promise<unknown>) => work(undefined as never));
    transactionRunner = { run: runMock } as unknown as TransactionRunner;

    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    auditLogService = { record: jest.fn() } as unknown as jest.Mocked<AuditLogService>;

    const configService = {
      get: jest.fn((key: string) =>
        ({ 'attendance.maxGpsAccuracyMeters': 50, 'attendance.maxClockSkewSeconds': 300 })[key],
      ),
    } as unknown as ConfigService;

    service = new AttendanceService(
      attendanceRepository,
      correctionRepository,
      overtimeRequestRepository,
      employeeRepository,
      transactionRunner,
      new GeofenceValidationStrategy(),
      eventEmitter,
      auditLogService,
      configService,
    );

    employeeRepository.findByUserId.mockResolvedValue(employee);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('checkIn', () => {
    it('mencatat ON_TIME saat check-in dalam radius & sebelum batas toleransi shift', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:10:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue(null);
      attendanceRepository.findActiveShiftAssignment.mockResolvedValue(shiftAssignment);
      const created = { id: 'attendance-1', status: AttendanceStatus.ON_TIME } as Attendance;
      attendanceRepository.create.mockResolvedValue(created);

      const result = await service.checkIn('user-1', {
        latitude: officeLat,
        longitude: officeLng,
        deviceTimestamp: '2026-01-15T08:10:00Z',
      });

      expect(result).toBe(created);
      expect(attendanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.ON_TIME, employeeId: employee.id }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ATTENDANCE_CHECKED_IN_EVENT,
        expect.objectContaining({ attendanceId: 'attendance-1', employeeId: employee.id }),
      );
    });

    it('mencatat LATE saat check-in melewati batas toleransi shift', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:20:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue(null);
      attendanceRepository.findActiveShiftAssignment.mockResolvedValue(shiftAssignment);
      attendanceRepository.create.mockResolvedValue({ id: 'attendance-1' } as Attendance);

      await service.checkIn('user-1', {
        latitude: officeLat,
        longitude: officeLng,
        deviceTimestamp: '2026-01-15T08:20:00Z',
      });

      expect(attendanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.LATE }),
      );
    });

    it('menolak dengan ForbiddenException (ATTENDANCE_OUT_OF_RADIUS) saat di luar radius', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:00:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue(null);

      await expect(
        service.checkIn('user-1', {
          latitude: farPoint.latitude,
          longitude: farPoint.longitude,
          deviceTimestamp: '2026-01-15T08:00:00Z',
        }),
      ).rejects.toMatchObject({
        response: { errorCode: 'ATTENDANCE_OUT_OF_RADIUS' },
      });
      expect(attendanceRepository.create).not.toHaveBeenCalled();
    });

    it('menolak dengan BadRequestException saat jam device menyimpang jauh dari jam server', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:00:00Z'));

      await expect(
        service.checkIn('user-1', {
          latitude: officeLat,
          longitude: officeLng,
          // 1 jam menyimpang dari server time, jauh melebihi toleransi default 300 detik.
          deviceTimestamp: '2026-01-15T07:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(attendanceRepository.create).not.toHaveBeenCalled();
    });

    it('menolak dengan ConflictException jika sudah check-in hari ini', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:00:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue({
        checkInTime: new Date('2026-01-15T08:00:00Z'),
      } as Attendance);

      await expect(
        service.checkIn('user-1', {
          latitude: officeLat,
          longitude: officeLng,
          deviceTimestamp: '2026-01-15T08:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(attendanceRepository.create).not.toHaveBeenCalled();
    });

    it('menolak dengan NotFoundException jika tidak ada jadwal shift', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T08:00:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue(null);
      attendanceRepository.findActiveShiftAssignment.mockResolvedValue(null);

      await expect(
        service.checkIn('user-1', {
          latitude: officeLat,
          longitude: officeLng,
          deviceTimestamp: '2026-01-15T08:00:00Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('checkOut', () => {
    it('menghitung work_duration_minutes & tetap ON_TIME jika pulang sesuai jadwal', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T17:05:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue({
        id: 'attendance-1',
        checkInTime: new Date('2026-01-15T08:00:00Z'),
        checkOutTime: null,
        status: AttendanceStatus.ON_TIME,
        shift: shiftAssignment.shift,
      } as unknown as Attendance);
      attendanceRepository.update.mockResolvedValue({ id: 'attendance-1' } as Attendance);

      await service.checkOut('user-1', {
        latitude: officeLat,
        longitude: officeLng,
        deviceTimestamp: '2026-01-15T17:05:00Z',
      });

      expect(attendanceRepository.update).toHaveBeenCalledWith(
        'attendance-1',
        expect.objectContaining({ workDurationMinutes: 545, status: AttendanceStatus.ON_TIME }),
      );
    });

    it('mengubah status menjadi EARLY_LEAVE jika pulang sebelum batas toleransi shift', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T16:30:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue({
        id: 'attendance-1',
        checkInTime: new Date('2026-01-15T08:00:00Z'),
        checkOutTime: null,
        status: AttendanceStatus.ON_TIME,
        shift: shiftAssignment.shift,
      } as unknown as Attendance);
      attendanceRepository.update.mockResolvedValue({ id: 'attendance-1' } as Attendance);

      await service.checkOut('user-1', {
        latitude: officeLat,
        longitude: officeLng,
        deviceTimestamp: '2026-01-15T16:30:00Z',
      });

      expect(attendanceRepository.update).toHaveBeenCalledWith(
        'attendance-1',
        expect.objectContaining({ status: AttendanceStatus.EARLY_LEAVE }),
      );
    });

    it('menolak dengan NotFoundException jika belum check-in', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T17:00:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue(null);

      await expect(
        service.checkOut('user-1', {
          latitude: officeLat,
          longitude: officeLng,
          deviceTimestamp: '2026-01-15T17:00:00Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('menolak dengan ConflictException jika sudah check-out', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T17:00:00Z'));
      attendanceRepository.findByEmployeeAndDate.mockResolvedValue({
        id: 'attendance-1',
        checkInTime: new Date('2026-01-15T08:00:00Z'),
        checkOutTime: new Date('2026-01-15T17:00:00Z'),
        status: AttendanceStatus.ON_TIME,
        shift: shiftAssignment.shift,
      } as unknown as Attendance);

      await expect(
        service.checkOut('user-1', {
          latitude: officeLat,
          longitude: officeLng,
          deviceTimestamp: '2026-01-15T17:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('approveCorrection', () => {
    const pendingCorrection = {
      id: 'correction-1',
      attendanceId: null,
      employeeId: employee.id,
      requestedDate: '2026-01-15',
      requestedCheckIn: new Date('2026-01-15T08:00:00Z'),
      requestedCheckOut: new Date('2026-01-15T17:00:00Z'),
      status: AttendanceCorrectionStatus.PENDING,
    } as unknown as AttendanceCorrection;

    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    it('mengizinkan atasan langsung menyetujui & membuat baris attendance baru (attendanceId null)', async () => {
      correctionRepository.findById.mockResolvedValue(pendingCorrection);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);
      attendanceRepository.findActiveShiftAssignment.mockResolvedValue(shiftAssignment);
      attendanceRepository.create.mockResolvedValue({ id: 'attendance-new' } as Attendance);
      correctionRepository.update.mockResolvedValue({
        ...pendingCorrection,
        status: AttendanceCorrectionStatus.APPROVED,
      } as AttendanceCorrection);

      const result = await service.approveCorrection(managerActingUser, 'correction-1');

      expect(attendanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: employee.id, shiftId: shiftAssignment.shiftId }),
        undefined,
      );
      expect(correctionRepository.update).toHaveBeenCalledWith(
        'correction-1',
        expect.objectContaining({ status: AttendanceCorrectionStatus.APPROVED, approvedBy: managerEmployee.id }),
        undefined,
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE_ATTENDANCE_CORRECTION',
          entityType: 'attendance_correction',
          entityId: 'correction-1',
        }),
        undefined,
      );
      expect(result.status).toBe(AttendanceCorrectionStatus.APPROVED);
    });

    it('menolak dengan ForbiddenException jika bukan atasan langsung & bukan HR/Super Admin', async () => {
      correctionRepository.findById.mockResolvedValue(pendingCorrection);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'other-manager' } as Employee);

      await expect(service.approveCorrection(managerActingUser, 'correction-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(attendanceRepository.create).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('menolak dengan ConflictException jika koreksi sudah diproses sebelumnya', async () => {
      correctionRepository.findById.mockResolvedValue({
        ...pendingCorrection,
        status: AttendanceCorrectionStatus.APPROVED,
      } as AttendanceCorrection);

      await expect(service.approveCorrection(managerActingUser, 'correction-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('rejectCorrection', () => {
    const pendingCorrection = {
      id: 'correction-1',
      attendanceId: null,
      employeeId: employee.id,
      requestedDate: '2026-01-15',
      status: AttendanceCorrectionStatus.PENDING,
    } as unknown as AttendanceCorrection;

    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    it('mengizinkan atasan langsung menolak & mencatat audit log DALAM SATU transaction (checklist §7)', async () => {
      correctionRepository.findById.mockResolvedValue(pendingCorrection);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);
      correctionRepository.update.mockResolvedValue({
        ...pendingCorrection,
        status: AttendanceCorrectionStatus.REJECTED,
      } as AttendanceCorrection);

      const result = await service.rejectCorrection(managerActingUser, 'correction-1');

      expect(correctionRepository.update).toHaveBeenCalledWith(
        'correction-1',
        expect.objectContaining({ status: AttendanceCorrectionStatus.REJECTED, approvedBy: managerEmployee.id }),
        undefined, // dari mock TransactionRunner (lihat runMock di beforeEach)
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REJECT_ATTENDANCE_CORRECTION',
          entityType: 'attendance_correction',
          entityId: 'correction-1',
        }),
        undefined,
      );
      expect(result.status).toBe(AttendanceCorrectionStatus.REJECTED);
    });

    it('menolak dengan ForbiddenException jika bukan atasan langsung & bukan HR/Super Admin', async () => {
      correctionRepository.findById.mockResolvedValue(pendingCorrection);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'other-manager' } as Employee);

      await expect(service.rejectCorrection(managerActingUser, 'correction-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(correctionRepository.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('findPendingCorrections', () => {
    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const hrActingUser = { userId: 'hr-user-1', role: UserRole.HR_ADMIN };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    const ownTeamCorrection = {
      id: 'correction-1',
      employeeId: employee.id,
      employee: { id: employee.id, managerId: 'manager-employee-1' },
    } as unknown as AttendanceCorrection;
    const otherTeamCorrection = {
      id: 'correction-2',
      employeeId: 'other-employee',
      employee: { id: 'other-employee', managerId: 'someone-else' },
    } as unknown as AttendanceCorrection;

    it('HR/Super Admin melihat semua koreksi PENDING tanpa disaring', async () => {
      correctionRepository.findByStatus.mockResolvedValue([ownTeamCorrection, otherTeamCorrection]);

      const result = await service.findPendingCorrections(hrActingUser);

      expect(result).toEqual([ownTeamCorrection, otherTeamCorrection]);
    });

    it('MANAGER hanya melihat koreksi milik anak buah langsungnya', async () => {
      correctionRepository.findByStatus.mockResolvedValue([ownTeamCorrection, otherTeamCorrection]);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);

      const result = await service.findPendingCorrections(managerActingUser);

      expect(result).toEqual([ownTeamCorrection]);
    });
  });

  describe('findShiftAssignments', () => {
    it('mengambil riwayat penugasan shift milik karyawan', async () => {
      const assignments = [{ id: 'assignment-1' } as EmployeeShiftAssignment];
      attendanceRepository.findShiftAssignmentsByEmployee.mockResolvedValue(assignments);

      const result = await service.findShiftAssignments('employee-1');

      expect(attendanceRepository.findShiftAssignmentsByEmployee).toHaveBeenCalledWith('employee-1');
      expect(result).toEqual(assignments);
    });
  });

  describe('assignShift', () => {
    it('membuat entry baru tanpa menutup entry lama jika belum ada penugasan terbuka', async () => {
      attendanceRepository.findOpenShiftAssignment.mockResolvedValue(null);
      attendanceRepository.createShiftAssignment.mockResolvedValue({ id: 'assignment-1' } as EmployeeShiftAssignment);

      await service.assignShift({
        employeeId: 'employee-1',
        shiftId: 'shift-1',
        effectiveDate: '2026-01-01',
      });

      expect(attendanceRepository.closeShiftAssignment).not.toHaveBeenCalled();
      expect(attendanceRepository.createShiftAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'employee-1', shiftId: 'shift-1', effectiveDate: '2026-01-01' }),
      );
    });

    it('menutup penugasan terbuka (endDate = sehari sebelum effectiveDate baru) sebelum membuat entry baru — checklist §8: tidak overwrite', async () => {
      attendanceRepository.findOpenShiftAssignment.mockResolvedValue({
        id: 'assignment-old',
        effectiveDate: '2025-01-01',
      } as EmployeeShiftAssignment);
      attendanceRepository.createShiftAssignment.mockResolvedValue({ id: 'assignment-new' } as EmployeeShiftAssignment);

      await service.assignShift({
        employeeId: 'employee-1',
        shiftId: 'shift-2',
        effectiveDate: '2026-07-01',
      });

      expect(attendanceRepository.closeShiftAssignment).toHaveBeenCalledWith('assignment-old', '2026-06-30', undefined);
      expect(attendanceRepository.createShiftAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'employee-1', shiftId: 'shift-2', effectiveDate: '2026-07-01' }),
        undefined,
      );
    });

    it('menolak dengan BadRequestException jika effectiveDate baru sebelum penugasan yang sedang aktif dimulai', async () => {
      attendanceRepository.findOpenShiftAssignment.mockResolvedValue({
        id: 'assignment-old',
        effectiveDate: '2026-07-01',
      } as EmployeeShiftAssignment);

      await expect(
        service.assignShift({
          employeeId: 'employee-1',
          shiftId: 'shift-2',
          effectiveDate: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(attendanceRepository.createShiftAssignment).not.toHaveBeenCalled();
    });
  });

  describe('requestOvertime', () => {
    it('membuat pengajuan lembur berstatus PENDING untuk employee yang sedang login', async () => {
      overtimeRequestRepository.create.mockResolvedValue({ id: 'overtime-1' } as OvertimeRequest);

      await service.requestOvertime('user-1', {
        date: '2026-01-15',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-15T20:00:00Z',
        reason: 'Tutup buku bulanan',
      });

      expect(overtimeRequestRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: employee.id,
          date: '2026-01-15',
          reason: 'Tutup buku bulanan',
          status: OvertimeRequestStatus.PENDING,
        }),
      );
    });

    it('menolak dengan BadRequestException jika endTime tidak setelah startTime', async () => {
      await expect(
        service.requestOvertime('user-1', {
          date: '2026-01-15',
          startTime: '2026-01-15T20:00:00Z',
          endTime: '2026-01-15T18:00:00Z',
          reason: 'Tutup buku bulanan',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(overtimeRequestRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('approveOvertime', () => {
    const pendingRequest = {
      id: 'overtime-1',
      employeeId: employee.id,
      status: OvertimeRequestStatus.PENDING,
    } as unknown as OvertimeRequest;

    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    it('mengizinkan atasan langsung menyetujui & mencatat audit log DALAM SATU transaction (checklist §7)', async () => {
      overtimeRequestRepository.findById.mockResolvedValue(pendingRequest);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);
      overtimeRequestRepository.update.mockResolvedValue({
        ...pendingRequest,
        status: OvertimeRequestStatus.APPROVED,
      } as OvertimeRequest);

      const result = await service.approveOvertime(managerActingUser, 'overtime-1');

      expect(overtimeRequestRepository.update).toHaveBeenCalledWith(
        'overtime-1',
        { status: OvertimeRequestStatus.APPROVED, approvedBy: managerEmployee.id },
        undefined,
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE_OVERTIME_REQUEST',
          entityType: 'overtime_request',
          entityId: 'overtime-1',
        }),
        undefined,
      );
      expect(result.status).toBe(OvertimeRequestStatus.APPROVED);
    });

    it('menolak dengan ForbiddenException jika bukan atasan langsung & bukan HR/Super Admin', async () => {
      overtimeRequestRepository.findById.mockResolvedValue(pendingRequest);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'other-manager' } as Employee);

      await expect(service.approveOvertime(managerActingUser, 'overtime-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(overtimeRequestRepository.update).not.toHaveBeenCalled();
    });

    it('menolak dengan ConflictException jika pengajuan sudah diproses sebelumnya', async () => {
      overtimeRequestRepository.findById.mockResolvedValue({
        ...pendingRequest,
        status: OvertimeRequestStatus.APPROVED,
      } as OvertimeRequest);

      await expect(service.approveOvertime(managerActingUser, 'overtime-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('rejectOvertime', () => {
    const pendingRequest = {
      id: 'overtime-1',
      employeeId: employee.id,
      status: OvertimeRequestStatus.PENDING,
    } as unknown as OvertimeRequest;

    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    it('mengizinkan atasan langsung menolak & mencatat audit log', async () => {
      overtimeRequestRepository.findById.mockResolvedValue(pendingRequest);
      employeeRepository.findById.mockResolvedValue(employee);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);
      overtimeRequestRepository.update.mockResolvedValue({
        ...pendingRequest,
        status: OvertimeRequestStatus.REJECTED,
      } as OvertimeRequest);

      const result = await service.rejectOvertime(managerActingUser, 'overtime-1');

      expect(overtimeRequestRepository.update).toHaveBeenCalledWith(
        'overtime-1',
        { status: OvertimeRequestStatus.REJECTED, approvedBy: managerEmployee.id },
        undefined,
      );
      expect(result.status).toBe(OvertimeRequestStatus.REJECTED);
    });
  });

  describe('findPendingOvertimeRequests', () => {
    const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
    const hrActingUser = { userId: 'hr-user-1', role: UserRole.HR_ADMIN };
    const managerEmployee = { id: 'manager-employee-1' } as Employee;

    const ownTeamRequest = {
      id: 'overtime-1',
      employeeId: employee.id,
      employee: { id: employee.id, managerId: 'manager-employee-1' },
    } as unknown as OvertimeRequest;
    const otherTeamRequest = {
      id: 'overtime-2',
      employeeId: 'other-employee',
      employee: { id: 'other-employee', managerId: 'someone-else' },
    } as unknown as OvertimeRequest;

    it('HR/Super Admin melihat semua pengajuan PENDING tanpa disaring', async () => {
      overtimeRequestRepository.findByStatus.mockResolvedValue([ownTeamRequest, otherTeamRequest]);

      const result = await service.findPendingOvertimeRequests(hrActingUser);

      expect(result).toEqual([ownTeamRequest, otherTeamRequest]);
    });

    it('MANAGER hanya melihat pengajuan milik anak buah langsungnya', async () => {
      overtimeRequestRepository.findByStatus.mockResolvedValue([ownTeamRequest, otherTeamRequest]);
      employeeRepository.findByUserId.mockResolvedValue(managerEmployee);

      const result = await service.findPendingOvertimeRequests(managerActingUser);

      expect(result).toEqual([ownTeamRequest]);
    });
  });
});
