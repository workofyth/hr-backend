import { Employee } from '../../employee/entities/employee.entity';

export interface ResolvedApprovalLevel {
  level: number;
  approverId: string;
}

/**
 * Chain of Responsibility — backend-architecture-hr.md §3: "Setiap level
 * approval adalah handler independen, mudah menambah/mengurangi level
 * approval tanpa mengubah logika inti." Setiap handler konkret men-resolve
 * approver untuk levelnya sendiri (atau `null` untuk melewati level itu,
 * mis. karyawan tanpa atasan langsung) lalu meneruskan ke handler berikut.
 */
export abstract class LeaveApprovalHandler {
  private nextHandler: LeaveApprovalHandler | null = null;

  setNext(handler: LeaveApprovalHandler): LeaveApprovalHandler {
    this.nextHandler = handler;
    return handler;
  }

  async buildChain(employee: Employee): Promise<ResolvedApprovalLevel[]> {
    const resolved = await this.resolve(employee);
    const rest = this.nextHandler ? await this.nextHandler.buildChain(employee) : [];
    return resolved ? [resolved, ...rest] : rest;
  }

  protected abstract resolve(employee: Employee): Promise<ResolvedApprovalLevel | null>;
}
