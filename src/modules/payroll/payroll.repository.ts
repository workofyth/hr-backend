import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { SalaryComponent } from './entities/salary-component.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { BpjsSetting } from './entities/bpjs-setting.entity';
import { TaxPtkpSetting } from './entities/tax-ptkp-setting.entity';
import { TaxTerRate } from './entities/tax-ter-rate.entity';
import { PayrollPeriod } from './entities/payroll-period.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';
import { IPayrollRepository } from './payroll-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel-tabel §5.5. Satu-satunya
 * tempat yang boleh query langsung ke tabel-tabel tersebut.
 */
@Injectable()
export class PayrollRepository implements IPayrollRepository {
  constructor(
    @InjectRepository(SalaryComponent) private readonly salaryComponentRepository: Repository<SalaryComponent>,
    @InjectRepository(EmployeeSalaryStructure)
    private readonly salaryStructureRepository: Repository<EmployeeSalaryStructure>,
    @InjectRepository(BpjsSetting) private readonly bpjsSettingRepository: Repository<BpjsSetting>,
    @InjectRepository(TaxPtkpSetting) private readonly ptkpSettingRepository: Repository<TaxPtkpSetting>,
    @InjectRepository(TaxTerRate) private readonly terRateRepository: Repository<TaxTerRate>,
    @InjectRepository(PayrollPeriod) private readonly periodRepository: Repository<PayrollPeriod>,
    @InjectRepository(PayrollItem) private readonly itemRepository: Repository<PayrollItem>,
    @InjectRepository(PayrollItemDetail) private readonly itemDetailRepository: Repository<PayrollItemDetail>,
  ) {}

  findSalaryComponents(companyId: string): Promise<SalaryComponent[]> {
    return this.salaryComponentRepository.find({ where: { companyId }, order: { name: 'ASC' } });
  }

  createSalaryComponent(data: DeepPartial<SalaryComponent>): Promise<SalaryComponent> {
    const component = this.salaryComponentRepository.create(data);
    return this.salaryComponentRepository.save(component);
  }

  findActiveSalaryStructures(employeeId: string, asOfDate: string): Promise<EmployeeSalaryStructure[]> {
    return this.salaryStructureRepository
      .createQueryBuilder('structure')
      .leftJoinAndSelect('structure.salaryComponent', 'salaryComponent')
      .where('structure.employee_id = :employeeId', { employeeId })
      .andWhere('structure.effective_date <= :asOfDate', { asOfDate })
      .andWhere('(structure.end_date IS NULL OR structure.end_date >= :asOfDate)', { asOfDate })
      .getMany();
  }

  findSalaryStructuresByEmployee(employeeId: string): Promise<EmployeeSalaryStructure[]> {
    return this.salaryStructureRepository.find({
      where: { employeeId },
      relations: ['salaryComponent'],
      order: { effectiveDate: 'DESC' },
    });
  }

  findOpenSalaryStructure(employeeId: string, salaryComponentId: string): Promise<EmployeeSalaryStructure | null> {
    return this.salaryStructureRepository
      .createQueryBuilder('structure')
      .where('structure.employee_id = :employeeId', { employeeId })
      .andWhere('structure.salary_component_id = :salaryComponentId', { salaryComponentId })
      .andWhere('structure.end_date IS NULL')
      .getOne();
  }

  createSalaryStructure(
    data: DeepPartial<EmployeeSalaryStructure>,
    manager?: EntityManager,
  ): Promise<EmployeeSalaryStructure> {
    const repository = manager ? manager.getRepository(EmployeeSalaryStructure) : this.salaryStructureRepository;
    const structure = repository.create(data);
    return repository.save(structure);
  }

  async closeSalaryStructure(id: string, endDate: string, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(EmployeeSalaryStructure) : this.salaryStructureRepository;
    await repository.update(id, { endDate });
  }

  findAllBpjsSettings(): Promise<BpjsSetting[]> {
    return this.bpjsSettingRepository.find({ order: { type: 'ASC', effectiveDate: 'DESC' } });
  }

  createBpjsSetting(data: DeepPartial<BpjsSetting>): Promise<BpjsSetting> {
    const setting = this.bpjsSettingRepository.create(data);
    return this.bpjsSettingRepository.save(setting);
  }

  findActiveBpjsSettings(asOfDate: string): Promise<BpjsSetting[]> {
    return this.bpjsSettingRepository
      .createQueryBuilder('setting')
      .distinctOn(['setting.type'])
      .where('setting.effective_date <= :asOfDate', { asOfDate })
      .orderBy('setting.type', 'ASC')
      .addOrderBy('setting.effective_date', 'DESC')
      .getMany();
  }

  findPtkpSetting(status: string, effectiveYear: number): Promise<TaxPtkpSetting | null> {
    return this.ptkpSettingRepository.findOne({ where: { status, effectiveYear } });
  }

  findAllPtkpSettings(): Promise<TaxPtkpSetting[]> {
    return this.ptkpSettingRepository.find({ order: { effectiveYear: 'DESC', status: 'ASC' } });
  }

  createPtkpSetting(data: DeepPartial<TaxPtkpSetting>): Promise<TaxPtkpSetting> {
    const setting = this.ptkpSettingRepository.create(data);
    return this.ptkpSettingRepository.save(setting);
  }

  findTerRate(category: string, effectiveYear: number, grossIncome: number): Promise<TaxTerRate | null> {
    return this.terRateRepository
      .createQueryBuilder('rate')
      .where('rate.category = :category', { category })
      .andWhere('rate.effective_year = :effectiveYear', { effectiveYear })
      .andWhere('rate.income_from <= :grossIncome', { grossIncome })
      .andWhere('rate.income_to > :grossIncome', { grossIncome })
      .getOne();
  }

  findAllTerRates(): Promise<TaxTerRate[]> {
    return this.terRateRepository.find({ order: { effectiveYear: 'DESC', category: 'ASC', incomeFrom: 'ASC' } });
  }

  createTerRate(data: DeepPartial<TaxTerRate>): Promise<TaxTerRate> {
    const rate = this.terRateRepository.create(data);
    return this.terRateRepository.save(rate);
  }

  findPeriodById(id: string): Promise<PayrollPeriod | null> {
    return this.periodRepository.findOne({ where: { id } });
  }

  findPeriod(companyId: string, periodMonth: number, periodYear: number): Promise<PayrollPeriod | null> {
    return this.periodRepository.findOne({ where: { companyId, periodMonth, periodYear } });
  }

  async findPeriods(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ items: PayrollPeriod[]; total: number }> {
    const [items, total] = await this.periodRepository.findAndCount({
      where: { companyId },
      order: { periodYear: 'DESC', periodMonth: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  createPeriod(data: DeepPartial<PayrollPeriod>, manager?: EntityManager): Promise<PayrollPeriod> {
    const repository = manager ? manager.getRepository(PayrollPeriod) : this.periodRepository;
    const period = repository.create(data);
    return repository.save(period);
  }

  async updatePeriod(
    id: string,
    data: DeepPartial<PayrollPeriod>,
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const repository = manager ? manager.getRepository(PayrollPeriod) : this.periodRepository;
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }

  findItemsByPeriod(periodId: string): Promise<PayrollItem[]> {
    return this.itemRepository.find({
      where: { payrollPeriodId: periodId },
      relations: ['employee'],
      order: { createdAt: 'ASC' },
    });
  }

  createItem(data: DeepPartial<PayrollItem>, manager?: EntityManager): Promise<PayrollItem> {
    const repository = manager ? manager.getRepository(PayrollItem) : this.itemRepository;
    const item = repository.create(data);
    return repository.save(item);
  }

  findItemDetails(payrollItemId: string): Promise<PayrollItemDetail[]> {
    return this.itemDetailRepository.find({ where: { payrollItemId } });
  }

  createItemDetail(data: DeepPartial<PayrollItemDetail>, manager?: EntityManager): Promise<PayrollItemDetail> {
    const repository = manager ? manager.getRepository(PayrollItemDetail) : this.itemDetailRepository;
    const detail = repository.create(data);
    return repository.save(detail);
  }
}
