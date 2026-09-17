import { Inject, Injectable } from '@nestjs/common';
import { LeaveApprovalHandler, ResolvedApprovalLevel } from './leave-approval-handler';
import { Employee } from '../../employee/entities/employee.entity';
import { EMPLOYEE_REPOSITORY } from '../../employee/employee.constants';
import { IEmployeeRepository } from '../../employee/employee-repository.interface';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * Level 2 — HR (roadmap Phase 3: "atasan langsung -> HR, bisa multi-level").
 * Approver dicari lewat IEmployeeRepository (Dependency Inversion, §3) —
 * bukan query langsung ke tabel `users`/`employees` dari modul leave.
 */
@Injectable()
export class HrApprovalHandler extends LeaveApprovalHandler {
  static readonly LEVEL = 2;

  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository) {
    super();
  }

  protected async resolve(employee: Employee): Promise<ResolvedApprovalLevel | null> {
    const hrAdmin = await this.employeeRepository.findFirstByCompanyAndRole(
      employee.companyId,
      UserRole.HR_ADMIN,
    );
    if (!hrAdmin) {
      return null;
    }
    return { level: HrApprovalHandler.LEVEL, approverId: hrAdmin.id };
  }
}
