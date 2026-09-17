import { NotFoundException } from '@nestjs/common';
import { Pph21Calculator } from './pph21.calculator';
import { IPayrollRepository } from '../payroll-repository.interface';
import { Employee, MaritalStatus } from '../../employee/entities/employee.entity';
import { TaxPtkpSetting } from '../entities/tax-ptkp-setting.entity';
import { TaxTerRate } from '../entities/tax-ter-rate.entity';

describe('Pph21Calculator (TER bulanan)', () => {
  let calculator: Pph21Calculator;
  let payrollRepository: jest.Mocked<IPayrollRepository>;

  beforeEach(() => {
    payrollRepository = {
      findActiveSalaryStructures: jest.fn(),
      findActiveBpjsSettings: jest.fn(),
      findPtkpSetting: jest.fn(),
      findTerRate: jest.fn(),
      findPeriodById: jest.fn(),
      findPeriod: jest.fn(),
      createPeriod: jest.fn(),
      updatePeriod: jest.fn(),
      findItemsByPeriod: jest.fn(),
      createItem: jest.fn(),
      findItemDetails: jest.fn(),
      createItemDetail: jest.fn(),
    };
    calculator = new Pph21Calculator(payrollRepository);
  });

  it('resolve status TK0 (TK, 0 tanggungan) -> kategori TER A, PPh21 = rate x bruto', async () => {
    const employee = { maritalStatus: MaritalStatus.TK, dependentsCount: 0 } as Employee;
    payrollRepository.findPtkpSetting.mockResolvedValue({ status: 'TK0' } as TaxPtkpSetting);
    payrollRepository.findTerRate.mockResolvedValue({ category: 'A', rate: '0.0200' } as TaxTerRate);

    const result = await calculator.calculate({ employee, grossMonthlyIncome: 6_000_000, effectiveYear: 2026 });

    expect(payrollRepository.findPtkpSetting).toHaveBeenCalledWith('TK0', 2026);
    expect(payrollRepository.findTerRate).toHaveBeenCalledWith('A', 2026, 6_000_000);
    expect(result).toEqual({ ptkpStatus: 'TK0', terCategory: 'A', terRate: 0.02, pph21Amount: 120_000 });
  });

  it('dependentsCount di atas 3 di-clamp ke 3 (K3 -> kategori TER C)', async () => {
    const employee = { maritalStatus: MaritalStatus.K, dependentsCount: 5 } as Employee;
    payrollRepository.findPtkpSetting.mockResolvedValue({ status: 'K3' } as TaxPtkpSetting);
    payrollRepository.findTerRate.mockResolvedValue({ category: 'C', rate: '0.3400' } as TaxTerRate);

    const result = await calculator.calculate({ employee, grossMonthlyIncome: 50_000_000, effectiveYear: 2026 });

    expect(payrollRepository.findPtkpSetting).toHaveBeenCalledWith('K3', 2026);
    expect(result.ptkpStatus).toBe('K3');
    expect(result.terCategory).toBe('C');
  });

  it('menolak dengan NotFoundException jika setting PTKP tahun tersebut belum dikonfigurasi', async () => {
    const employee = { maritalStatus: MaritalStatus.TK, dependentsCount: 0 } as Employee;
    payrollRepository.findPtkpSetting.mockResolvedValue(null);

    await expect(
      calculator.calculate({ employee, grossMonthlyIncome: 6_000_000, effectiveYear: 2026 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(payrollRepository.findTerRate).not.toHaveBeenCalled();
  });

  it('menolak dengan NotFoundException jika tarif TER untuk bracket penghasilan tersebut belum dikonfigurasi', async () => {
    const employee = { maritalStatus: MaritalStatus.TK, dependentsCount: 0 } as Employee;
    payrollRepository.findPtkpSetting.mockResolvedValue({ status: 'TK0' } as TaxPtkpSetting);
    payrollRepository.findTerRate.mockResolvedValue(null);

    await expect(
      calculator.calculate({ employee, grossMonthlyIncome: 6_000_000, effectiveYear: 2026 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
