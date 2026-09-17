import { Employee, MaritalStatus } from '../../employee/entities/employee.entity';

const MAX_PTKP_DEPENDENTS = 3;

/**
 * Status PTKP (mis. TK0, K2) dari data karyawan — dipakai `Pph21Calculator`
 * (bulanan, TER) dan `Pph21AnnualReconciliationCalculator` (tahunan,
 * progresif) supaya logikanya tidak diduplikasi & tidak bisa drift.
 */
export function resolvePtkpStatus(employee: Employee): string {
  const dependents = Math.min(Math.max(employee.dependentsCount, 0), MAX_PTKP_DEPENDENTS);
  const maritalPrefix = employee.maritalStatus === MaritalStatus.K ? 'K' : 'TK';
  return `${maritalPrefix}${dependents}`;
}
