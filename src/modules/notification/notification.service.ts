import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { ATTENDANCE_CHECKED_IN_EVENT } from '../attendance/attendance.constants';
import { AttendanceCheckedInEvent } from '../attendance/events/attendance-checked-in.event';
import { AttendanceStatus } from '../attendance/entities/attendance.entity';

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
 * event `attendance.checked_in` secara async (decoupled dari
 * AttendanceService) lalu mencatat notifikasi in-app. Pengiriman lewat
 * channel eksternal (push/email, `channels/`) menyusul saat integrasi
 * provider (FCM/SMTP) tersedia — lihat catatan di .env.example.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectRepository(Notification) private readonly repository: Repository<Notification>) {}

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
}
