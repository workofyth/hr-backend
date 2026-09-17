import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { ATTENDANCE_CHECKED_IN_EVENT } from '../attendance/attendance.constants';
import { AttendanceCheckedInEvent } from '../attendance/events/attendance-checked-in.event';
import { AttendanceStatus } from '../attendance/entities/attendance.entity';
import { LEAVE_REJECTED_EVENT } from '../leave/leave.constants';
import { LeaveRejectedEvent } from '../leave/events/leave-rejected.event';
import { PAYROLL_GENERATED_EVENT } from '../payroll/payroll.constants';
import { PayrollGeneratedEvent } from '../payroll/events/payroll-generated.event';
import { PAYROLL_REPOSITORY } from '../payroll/payroll.constants';
import { IPayrollRepository } from '../payroll/payroll-repository.interface';
import { EMPLOYEE_REPOSITORY } from '../employee/employee.constants';
import { IEmployeeRepository } from '../employee/employee-repository.interface';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.ON_TIME]: 'tepat waktu',
  [AttendanceStatus.LATE]: 'terlambat',
  [AttendanceStatus.EARLY_LEAVE]: 'pulang cepat',
  [AttendanceStatus.ABSENT]: 'alpha',
  [AttendanceStatus.ON_LEAVE]: 'cuti',
  [AttendanceStatus.WFH]: 'WFH',
};

/**
 * Observer/Event-driven — backend-architecture-hr.md §3 & §6: mendengarkan
 * `attendance.checked_in`, `leave.rejected`, `payroll.generated` secara
 * async (decoupled dari modul penerbit event) lalu mencatat notifikasi
 * in-app. Pengiriman lewat channel eksternal (push/email, `channels/`)
 * menyusul saat integrasi provider (FCM/SMTP) tersedia — lihat catatan di
 * .env.example.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification) private readonly repository: Repository<Notification>,
    @Inject(PAYROLL_REPOSITORY) private readonly payrollRepository: IPayrollRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
  ) {}

  @OnEvent(ATTENDANCE_CHECKED_IN_EVENT)
  async handleAttendanceCheckedIn(event: AttendanceCheckedInEvent): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          userId: event.userId,
          title: 'Check-in berhasil',
          body: `Absen masuk tercatat ${STATUS_LABEL[event.status]} pukul ${event.checkInTime.toISOString()}.`,
          type: 'ATTENDANCE_CHECKED_IN',
        }),
      );
    } catch (error) {
      // Notifikasi bersifat best-effort/async — kegagalan di sini tidak
      // boleh menggagalkan proses check-in yang sudah tercatat.
      this.logger.error('Gagal membuat notifikasi attendance.checked_in', error as Error);
    }
  }

  @OnEvent(LEAVE_REJECTED_EVENT)
  async handleLeaveRejected(event: LeaveRejectedEvent): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          userId: event.userId,
          title: 'Pengajuan cuti ditolak',
          body: `Pengajuan cuti Anda (${event.startDate} s/d ${event.endDate}) ditolak.${
            event.comment ? ` Alasan: ${event.comment}` : ''
          }`,
          type: 'LEAVE_REJECTED',
        }),
      );
    } catch (error) {
      this.logger.error('Gagal membuat notifikasi leave.rejected', error as Error);
    }
  }

  /**
   * Satu notifikasi per employee yang punya payroll_item pada periode ini
   * — event hanya bawa `payrollPeriodId`/`payrollItemIds`, employeeId
   * (untuk resolve userId) diambil dari `payroll_items` lewat
   * PAYROLL_REPOSITORY (Dependency Inversion, §3 — tidak query tabel
   * payroll_items langsung).
   */
  @OnEvent(PAYROLL_GENERATED_EVENT)
  async handlePayrollGenerated(event: PayrollGeneratedEvent): Promise<void> {
    try {
      const items = await this.payrollRepository.findItemsByPeriod(event.payrollPeriodId);
      for (const item of items) {
        const employee = await this.employeeRepository.findById(item.employeeId);
        if (!employee) continue;

        await this.repository.save(
          this.repository.create({
            userId: employee.userId,
            title: 'Slip gaji sudah digenerate',
            body: 'Slip gaji Anda untuk periode ini sudah dihitung dan menunggu approval HR.',
            type: 'PAYROLL_GENERATED',
          }),
        );
      }
    } catch (error) {
      this.logger.error('Gagal membuat notifikasi payroll.generated', error as Error);
    }
  }
}
