import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { EmployeeModule } from '../employee/employee.module';
import { PayrollModule } from '../payroll/payroll.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    // EMPLOYEE_REPOSITORY: resolve employeeId -> userId (notifications.user_id
    // adalah FK ke users, event dari Payroll hanya bawa employeeId).
    EmployeeModule,
    // PAYROLL_REPOSITORY: ambil daftar payroll_items satu periode saat
    // menangani `payroll.generated` (event hanya bawa payrollPeriodId).
    PayrollModule,
  ],
  providers: [NotificationService],
})
export class NotificationModule {}
