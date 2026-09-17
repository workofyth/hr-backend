import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { leaveEntities } from './entities';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRepository } from './leave.repository';
import { LEAVE_REPOSITORY } from './leave.constants';
import { ManagerApprovalHandler } from './approval/manager-approval.handler';
import { HrApprovalHandler } from './approval/hr-approval.handler';
import { LeaveApprovalChainFactory } from './approval/leave-approval-chain.factory';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature(leaveEntities),
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
    { provide: LEAVE_REPOSITORY, useClass: LeaveRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
})
export class LeaveModule {}
