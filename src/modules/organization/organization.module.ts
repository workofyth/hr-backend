import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../database/entities/company.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Department } from '../../database/entities/department.entity';
import { Position } from '../../database/entities/position.entity';
import { Shift } from '../../database/entities/shift.entity';
import { Holiday } from '../../database/entities/holiday.entity';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Branch, Department, Position, Shift, Holiday])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
