import { BpjsCalculator } from './bpjs.calculator';
import { IPayrollRepository } from '../payroll-repository.interface';
import { BpjsSetting, BpjsType } from '../entities/bpjs-setting.entity';

describe('BpjsCalculator', () => {
  let calculator: BpjsCalculator;
  let payrollRepository: jest.Mocked<IPayrollRepository>;

  const settings = [
    { type: BpjsType.JHT, companyPercentage: '0.0370', employeePercentage: '0.0200', maxSalaryBase: null },
    { type: BpjsType.JKK, companyPercentage: '0.0024', employeePercentage: '0.0000', maxSalaryBase: null },
    { type: BpjsType.JKM, companyPercentage: '0.0030', employeePercentage: '0.0000', maxSalaryBase: null },
    { type: BpjsType.JP, companyPercentage: '0.0200', employeePercentage: '0.0100', maxSalaryBase: '10000000.00' },
    {
      type: BpjsType.KESEHATAN,
      companyPercentage: '0.0400',
      employeePercentage: '0.0100',
      maxSalaryBase: '12000000.00',
    },
  ] as unknown as BpjsSetting[];

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
    calculator = new BpjsCalculator(payrollRepository);
  });

  it('menghitung split company/employee untuk semua jenis BPJS saat gaji di bawah batas atas', async () => {
    payrollRepository.findActiveBpjsSettings.mockResolvedValue(settings);

    const result = await calculator.calculate({ monthlySalary: 8_000_000, effectiveDate: '2026-06-30' });

    // JHT: company 8jt*3.7%=296.000, employee 8jt*2%=160.000
    // JKK: company 8jt*0.24%=19.200, employee 0
    // JKM: company 8jt*0.3%=24.000, employee 0
    // JP : company 8jt*2%=160.000, employee 8jt*1%=80.000
    // KESEHATAN: company 8jt*4%=320.000, employee 8jt*1%=80.000
    expect(result.totalCompanyAmount).toBe(819_200);
    expect(result.totalEmployeeAmount).toBe(320_000);
    expect(result.components).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: BpjsType.JHT, companyAmount: 296_000, employeeAmount: 160_000 })]),
    );
  });

  it('membatasi basis iuran ke maxSalaryBase saat gaji melebihi batas atas (JP & KESEHATAN)', async () => {
    payrollRepository.findActiveBpjsSettings.mockResolvedValue(settings);

    const result = await calculator.calculate({ monthlySalary: 15_000_000, effectiveDate: '2026-06-30' });

    const jp = result.components.find((c) => c.type === BpjsType.JP);
    const kesehatan = result.components.find((c) => c.type === BpjsType.KESEHATAN);
    const jht = result.components.find((c) => c.type === BpjsType.JHT);

    // JP dibatasi ke 10.000.000: company 200.000, employee 100.000
    expect(jp).toMatchObject({ companyAmount: 200_000, employeeAmount: 100_000 });
    // KESEHATAN dibatasi ke 12.000.000: company 480.000, employee 120.000
    expect(kesehatan).toMatchObject({ companyAmount: 480_000, employeeAmount: 120_000 });
    // JHT tidak ada batas -> tetap dari gaji penuh 15.000.000: company 555.000, employee 300.000
    expect(jht).toMatchObject({ companyAmount: 555_000, employeeAmount: 300_000 });
  });
});
