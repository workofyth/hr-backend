import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

export interface RecordAuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * Audit trail — backend-architecture-hr.md §4 & checklist §7: "siapa
 * mengubah gaji karyawan, siapa approve cuti, kapan". Cross-cutting,
 * ditempatkan di common/ (bukan di dalam satu modul fitur) supaya modul
 * lain (leave, employee, dst) bisa memakainya nanti tanpa saling
 * bergantung. Dipakai pertama kali oleh PayrollService.
 */
@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repository: Repository<AuditLog>) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.repository.save(
      this.repository.create({
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        ipAddress: null,
      }),
    );
  }
}
