import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Department } from '../../database/entities/department.entity';
import { Position } from '../../database/entities/position.entity';
import { Shift } from '../../database/entities/shift.entity';
import { Holiday } from '../../database/entities/holiday.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

/**
 * Data referensi organisasi (§5.1). Sekarang punya CRUD penuh (bukan lagi
 * read-only lewat migration/SQL manual) — sejak `hr-admin-dashboard` §5
 * ("Organization Settings: Kelola cabang, departemen, jabatan, shift, hari
 * libur") butuh mengelola data ini dari UI, bukan cuma menampilkannya.
 * Tetap tanpa logika bisnis kompleks — murni CRUD data referensi.
 */
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Department) private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Position) private readonly positionRepository: Repository<Position>,
    @InjectRepository(Shift) private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Holiday) private readonly holidayRepository: Repository<Holiday>,
  ) {}

  // --- Companies ---

  findCompanies(): Promise<Company[]> {
    return this.companyRepository.find({ order: { name: 'ASC' } });
  }

  createCompany(dto: CreateCompanyDto): Promise<Company> {
    return this.companyRepository.save(this.companyRepository.create(dto));
  }

  async updateCompany(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.getCompanyOrThrow(id);
    await this.companyRepository.update(id, dto);
    return this.getCompanyOrThrow(id);
  }

  // --- Branches ---

  findBranches(companyId?: string): Promise<Branch[]> {
    return this.branchRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  createBranch(dto: CreateBranchDto): Promise<Branch> {
    return this.branchRepository.save(
      this.branchRepository.create({
        companyId: dto.companyId,
        name: dto.name,
        latitude: dto.latitude.toFixed(7),
        longitude: dto.longitude.toFixed(7),
        radiusMeters: dto.radiusMeters,
      }),
    );
  }

  async updateBranch(id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.getBranchOrThrow(id);
    await this.branchRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude.toFixed(7) } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude.toFixed(7) } : {}),
      ...(dto.radiusMeters !== undefined ? { radiusMeters: dto.radiusMeters } : {}),
    });
    return this.getBranchOrThrow(id);
  }

  // --- Departments ---

  findDepartments(companyId?: string): Promise<Department[]> {
    return this.departmentRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    return this.departmentRepository.save(this.departmentRepository.create(dto));
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    await this.getDepartmentOrThrow(id);
    await this.departmentRepository.update(id, dto);
    return this.getDepartmentOrThrow(id);
  }

  // --- Positions ---

  findPositions(companyId?: string): Promise<Position[]> {
    return this.positionRepository.find({
      where: companyId ? { companyId } : {},
      order: { title: 'ASC' },
    });
  }

  createPosition(dto: CreatePositionDto): Promise<Position> {
    return this.positionRepository.save(this.positionRepository.create(dto));
  }

  async updatePosition(id: string, dto: UpdatePositionDto): Promise<Position> {
    await this.getPositionOrThrow(id);
    await this.positionRepository.update(id, dto);
    return this.getPositionOrThrow(id);
  }

  // --- Shifts ---

  findShifts(companyId?: string): Promise<Shift[]> {
    return this.shiftRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  createShift(dto: CreateShiftDto): Promise<Shift> {
    return this.shiftRepository.save(this.shiftRepository.create(dto));
  }

  async updateShift(id: string, dto: UpdateShiftDto): Promise<Shift> {
    await this.getShiftOrThrow(id);
    await this.shiftRepository.update(id, dto);
    return this.getShiftOrThrow(id);
  }

  // --- Holidays ---

  findHolidays(companyId?: string): Promise<Holiday[]> {
    return this.holidayRepository.find({
      where: companyId ? { companyId } : {},
      order: { date: 'ASC' },
    });
  }

  createHoliday(dto: CreateHolidayDto): Promise<Holiday> {
    return this.holidayRepository.save(this.holidayRepository.create(dto));
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    await this.getHolidayOrThrow(id);
    await this.holidayRepository.update(id, dto);
    return this.getHolidayOrThrow(id);
  }

  // ---------------------------------------------------------------------
  // Helper privat
  // ---------------------------------------------------------------------

  private async getCompanyOrThrow(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company tidak ditemukan');
    return company;
  }

  private async getBranchOrThrow(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Cabang tidak ditemukan');
    return branch;
  }

  private async getDepartmentOrThrow(id: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({ where: { id } });
    if (!department) throw new NotFoundException('Departemen tidak ditemukan');
    return department;
  }

  private async getPositionOrThrow(id: string): Promise<Position> {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) throw new NotFoundException('Jabatan tidak ditemukan');
    return position;
  }

  private async getShiftOrThrow(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift tidak ditemukan');
    return shift;
  }

  private async getHolidayOrThrow(id: string): Promise<Holiday> {
    const holiday = await this.holidayRepository.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Hari libur tidak ditemukan');
    return holiday;
  }
}
