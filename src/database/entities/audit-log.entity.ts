import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../modules/auth/entities/user.entity';

/**
 * audit_logs — backend-architecture-hr.md §5.6.
 * Sama seperti `notifications`, HANYA punya `created_at` (bukan BaseEntity
 * §5 penuh) — audit trail bersifat append-only, tidak pernah
 * diedit/di-soft-delete. Checklist §7: "Ada audit log untuk perubahan data
 * gaji & approval" — dipakai pertama kali oleh PayrollService (approve()).
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
