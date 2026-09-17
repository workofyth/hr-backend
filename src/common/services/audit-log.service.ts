import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

export interface RecordAuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export interface FindAuditLogsFilter {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
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

  /**
   * Audit log viewer (admin-dashboard-web-hr.md) — filter opsional per
   * kolom + rentang tanggal, dengan relasi `user` (email pelaku) di-load
   * supaya dashboard tidak perlu query tambahan.
   */
  async findAll(filter: FindAuditLogsFilter): Promise<PaginatedAuditLogs> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.dateFrom && filter.dateTo) {
      // dateTo dianggap inklusif seluruh hari itu (bukan cut-off tengah malam).
      where.createdAt = Between(new Date(`${filter.dateFrom}T00:00:00.000Z`), new Date(`${filter.dateTo}T23:59:59.999Z`));
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    });

    return { items, total };
  }
}
