import { Injectable } from '@nestjs/common';
import { LeaveApprovalHandler, ResolvedApprovalLevel } from './leave-approval-handler';
import { Employee } from '../../employee/entities/employee.entity';

/**
 * Level 1 — atasan langsung (employees.manager_id, §5.2), sesuai roadmap
 * Phase 3: "Alur approval berjenjang (atasan langsung -> HR)". Karyawan
 * tanpa atasan (mis. sudah level tertinggi) melewati level ini — chain
 * lanjut ke handler berikutnya, bukan error.
 */
@Injectable()
export class ManagerApprovalHandler extends LeaveApprovalHandler {
  static readonly LEVEL = 1;

  protected async resolve(employee: Employee): Promise<ResolvedApprovalLevel | null> {
    if (!employee.managerId) {
      return null;
    }
    return { level: ManagerApprovalHandler.LEVEL, approverId: employee.managerId };
  }
}
