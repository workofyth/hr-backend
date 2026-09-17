import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Department } from '../../database/entities/department.entity';
import { Position } from '../../database/entities/position.entity';

/**
 * Data referensi organisasi (§5.1) — read-only. Tidak ada logika bisnis;
 * dipakai untuk populate dropdown di Admin Dashboard & form create/update
 * karyawan. CRUD penuh untuk companies/branches/departments/positions belum
 * dibuat (data masih diisi lewat migration/SQL manual) — lihat catatan di
 * backend-architecture-hr.md §2.
 */
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Department) private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Position) private readonly positionRepository: Repository<Position>,
  ) {}

  findCompanies(): Promise<Company[]> {
    return this.companyRepository.find({ order: { name: 'ASC' } });
  }

  findBranches(companyId?: string): Promise<Branch[]> {
    return this.branchRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  findDepartments(companyId?: string): Promise<Department[]> {
    return this.departmentRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  findPositions(companyId?: string): Promise<Position[]> {
    return this.positionRepository.find({
      where: companyId ? { companyId } : {},
      order: { title: 'ASC' },
    });
  }
}
