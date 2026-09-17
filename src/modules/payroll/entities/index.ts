import { SalaryComponent } from './salary-component.entity';
import { EmployeeSalaryStructure } from './employee-salary-structure.entity';
import { TaxPtkpSetting } from './tax-ptkp-setting.entity';
import { TaxTerRate } from './tax-ter-rate.entity';
import { BpjsSetting } from './bpjs-setting.entity';
import { PayrollPeriod } from './payroll-period.entity';
import { PayrollItem } from './payroll-item.entity';
import { PayrollItemDetail } from './payroll-item-detail.entity';
import { Payslip } from './payslip.entity';
import { SeveranceCalculation } from './severance-calculation.entity';

export {
  SalaryComponent,
  EmployeeSalaryStructure,
  TaxPtkpSetting,
  TaxTerRate,
  BpjsSetting,
  PayrollPeriod,
  PayrollItem,
  PayrollItemDetail,
  Payslip,
  SeveranceCalculation,
};

export const payrollEntities = [
  SalaryComponent,
  EmployeeSalaryStructure,
  TaxPtkpSetting,
  TaxTerRate,
  BpjsSetting,
  PayrollPeriod,
  PayrollItem,
  PayrollItemDetail,
  Payslip,
  SeveranceCalculation,
];
