import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Branch } from './branch.entity';
import { Department } from './department.entity';
import { Position } from './position.entity';
import { Shift } from './shift.entity';
import { Holiday } from './holiday.entity';

/**
 * companies — backend-architecture-hr.md §5.1
 */
@Entity('companies')
export class Company extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  npwp: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @OneToMany(() => Branch, (branch) => branch.company)
  branches: Branch[];

  @OneToMany(() => Department, (department) => department.company)
  departments: Department[];

  @OneToMany(() => Position, (position) => position.company)
  positions: Position[];

  @OneToMany(() => Shift, (shift) => shift.company)
  shifts: Shift[];

  @OneToMany(() => Holiday, (holiday) => holiday.company)
  holidays: Holiday[];
}
