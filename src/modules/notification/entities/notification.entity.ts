import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/**
 * notifications — backend-architecture-hr.md §5.6.
 * Catatan: berbeda dari BaseEntity (§5) tabel ini HANYA punya `created_at`
 * sesuai skema §5.6 — tidak ada `updated_at`/`deleted_at` (notifikasi
 * bersifat append-only, tidak pernah diedit/di-soft-delete).
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
