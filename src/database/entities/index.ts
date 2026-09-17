import { Company } from './company.entity';
import { Branch } from './branch.entity';
import { Department } from './department.entity';
import { Position } from './position.entity';
import { Shift } from './shift.entity';
import { Holiday } from './holiday.entity';
import { AuditLog } from './audit-log.entity';

export { Company, Branch, Department, Position, Shift, Holiday, AuditLog };

/**
 * Entity Core/Organisasi (§5.1) & cross-cutting (§5.6) — dikumpulkan di sini
 * karena tidak dimiliki satu modul spesifik (lihat backend-architecture-hr.md
 * §2: "database/entities/ # jika pakai ORM terpisah dari modul").
 */
export const coreEntities = [Company, Branch, Department, Position, Shift, Holiday, AuditLog];
