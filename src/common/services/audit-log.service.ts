import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

  /**
   * `manager` opsional — WAJIB diteruskan saat dipanggil di dalam
   * `TransactionRunner.run()` supaya baris audit_logs ikut rollback jika
   * operasi lain di transaction yang sama gagal (checklist §7: "Semua
   * operasi multi-tabel dibungkus transaction").
   */
  async record(input: RecordAuditLogInput, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditLog) : this.repository;
    await repository.save(
      repository.create({
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
