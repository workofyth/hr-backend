import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Employee } from './entities/employee.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeeShiftAssignment } from './entities/employee-shift-assignment.entity';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EMPLOYEE_REPOSITORY } from './employee.constants';
import { EmployeeRepository } from './employee.repository';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, EmployeeDocument, EmployeeShiftAssignment]),
    // Untuk USER_REPOSITORY — EmployeeService.create() sekaligus membuat
    // akun login (users) karena employees.user_id NOT NULL (§5.2).
    AuthModule,
  ],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    { provide: EMPLOYEE_REPOSITORY, useClass: EmployeeRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
})
export class EmployeeModule {}
