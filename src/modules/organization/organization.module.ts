import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../database/entities/company.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Department } from '../../database/entities/department.entity';
import { Position } from '../../database/entities/position.entity';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Branch, Department, Position])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
