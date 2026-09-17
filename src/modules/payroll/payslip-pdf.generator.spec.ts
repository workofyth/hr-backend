import { PayslipPdfGenerator } from './payslip-pdf.generator';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';
import { SalaryComponentType } from './entities/salary-component.entity';
import { EmploymentType } from '../employee/entities/employee.entity';

describe('PayslipPdfGenerator', () => {
  it('menghasilkan buffer PDF valid (magic bytes %PDF) berisi data payroll item', async () => {
    const generator = new PayslipPdfGenerator();

    const item = {
      grossSalary: '5000000.00',
      totalOvertime: '110000.00',
      totalDeductionUnpaid: '0.00',
      bpjsEmployeeTotal: '162800.00',
      pph21Amount: '81400.00',
      netSalary: '4865800.00',
      employee: {
        fullName: 'Budi Santoso',
        employeeCode: 'EMP-001',
        employmentType: EmploymentType.PKWTT,
      },
      payrollPeriod: {
        periodMonth: 6,
        periodYear: 2026,
      },
    } as unknown as PayrollItem;

    const details = [
      { componentName: 'Gaji Pokok', componentType: SalaryComponentType.EARNING, amount: '4500000.00' },
      { componentName: 'Tunjangan Transport', componentType: SalaryComponentType.EARNING, amount: '500000.00' },
      { componentName: 'BPJS Kesehatan', componentType: SalaryComponentType.DEDUCTION, amount: '40700.00' },
    ] as unknown as PayrollItemDetail[];

    const buffer = await generator.generate(item, details);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
