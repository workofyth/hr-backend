import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { leaveEntities } from './entities';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRepository } from './leave.repository';
import { LEAVE_REPOSITORY } from './leave.constants';
import { ManagerApprovalHandler } from './approval/manager-approval.handler';
import { HrApprovalHandler } from './approval/hr-approval.handler';
import { LeaveApprovalChainFactory } from './approval/leave-approval-chain.factory';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([...leaveEntities, AuditLog]),
    // Untuk EMPLOYEE_REPOSITORY — LeaveService & HrApprovalHandler perlu
    // data karyawan (managerId, companyId, resolve HR_ADMIN).
    EmployeeModule,
  ],
  controllers: [LeaveController],
  providers: [
    LeaveService,
    ManagerApprovalHandler,
    HrApprovalHandler,
    LeaveApprovalChainFactory,
    AuditLogService,
    { provide: LEAVE_REPOSITORY, useClass: LeaveRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
  // LEAVE_REPOSITORY diekspor supaya modul lain (mis. payroll — potongan
  // unpaid leave, roadmap Phase 4) bisa membaca leave_requests tanpa
  // mengakses tabelnya langsung (Repository Pattern, §3).
  exports: [LEAVE_REPOSITORY],
})
export class LeaveModule {}
