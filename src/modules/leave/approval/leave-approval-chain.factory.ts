import { Injectable } from '@nestjs/common';
import { ManagerApprovalHandler } from './manager-approval.handler';
import { HrApprovalHandler } from './hr-approval.handler';
import { ResolvedApprovalLevel } from './leave-approval-handler';
import { Employee } from '../../employee/entities/employee.entity';

/**
 * Factory Pattern (§3): merangkai Chain of Responsibility approval cuti
 * (manager -> HR) di satu tempat, supaya LeaveService tidak perlu tahu
 * urutan/isi handler-nya. Menambah level baru (mis. Direktur untuk cuti
 * panjang) = tambah handler baru & sambungkan di sini, tanpa ubah
 * LeaveService.
 */
@Injectable()
export class LeaveApprovalChainFactory {
  constructor(
    private readonly managerHandler: ManagerApprovalHandler,
    private readonly hrHandler: HrApprovalHandler,
  ) {
    this.managerHandler.setNext(this.hrHandler);
  }

  buildFor(employee: Employee): Promise<ResolvedApprovalLevel[]> {
    return this.managerHandler.buildChain(employee);
  }
}
