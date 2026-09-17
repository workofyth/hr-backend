import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { Employee } from '../employee/entities/employee.entity';
import { IAttendanceRepository, AttendanceStatusCounts } from '../attendance/attendance-repository.interface';
import { AttendanceStatus } from '../attendance/entities/attendance.entity';
import { ILeaveRepository } from '../leave/leave-repository.interface';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { LeaveRequestStatus } from '../leave/entities/leave-request.entity';
import { IPayrollRepository } from '../payroll/payroll-repository.interface';
import { PayrollPeriod, PayrollPeriodStatus } from '../payroll/entities/payroll-period.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;
  let attendanceRepository: jest.Mocked<IAttendanceRepository>;
  let leaveRepository: jest.Mocked<ILeaveRepository>;
  let payrollRepository: jest.Mocked<IPayrollRepository>;

  const zeroCounts: AttendanceStatusCounts = {
    [AttendanceStatus.ON_TIME]: 0,
    [AttendanceStatus.LATE]: 0,
    [AttendanceStatus.EARLY_LEAVE]: 0,
    [AttendanceStatus.ABSENT]: 0,
    [AttendanceStatus.ON_LEAVE]: 0,
    [AttendanceStatus.WFH]: 0,
    totalWorkDurationMinutes: 0,
  };

  beforeEach(() => {
    employeeRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeCode: jest.fn(),
      findFirstByCompanyAndRole: jest.fn(),
      findActiveByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    attendanceRepository = {
      findByEmployeeAndDate: jest.fn(),
      findById: jest.fn(),
      findHistory: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findActiveShiftAssignment: jest.fn(),
      countStatusesByEmployee: jest.fn(),
    };

    leaveRepository = {
      findLeaveTypeById: jest.fn(),
      findAllLeaveTypes: jest.fn(),
      findBalance: jest.fn(),
      findBalancesByEmployee: jest.fn(),
      updateBalance: jest.fn(),
      findRequestById: jest.fn(),
      findRequestsByEmployee: jest.fn(),
      findApprovedRequestsOverlapping: jest.fn(),
      createRequest: jest.fn(),
      updateRequest: jest.fn(),
      findApprovalsByRequestId: jest.fn(),
      createApproval: jest.fn(),
      updateApproval: jest.fn(),
      countByEmployeeAndStatus: jest.fn(),
    };

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

    service = new ReportsService(employeeRepository, attendanceRepository, leaveRepository, payrollRepository);
  });

  describe('getAttendanceSummary', () => {
    it('mengambil rekap status per karyawan dalam scope company/branch/department yang diminta', async () => {
      employeeRepository.findActiveByCompany.mockResolvedValue([
        {
          id: 'employee-1',
          employeeCode: 'EMP001',
          fullName: 'Budi',
          branch: { name: 'Cabang Jakarta' },
          department: { name: 'Operasional' },
        } as unknown as Employee,
      ]);
      attendanceRepository.countStatusesByEmployee.mockResolvedValue({
        ...zeroCounts,
        [AttendanceStatus.ON_TIME]: 20,
        [AttendanceStatus.LATE]: 2,
        totalWorkDurationMinutes: 9600,
      });

      const result = await service.getAttendanceSummary({
        companyId: 'company-1',
        branchId: 'branch-1',
        departmentId: 'department-1',
        month: 6,
        year: 2026,
      });

      expect(employeeRepository.findActiveByCompany).toHaveBeenCalledWith('company-1', 'branch-1', 'department-1');
      expect(attendanceRepository.countStatusesByEmployee).toHaveBeenCalledWith(
        'employee-1',
        '2026-06-01',
        '2026-06-30',
      );
      expect(result).toEqual([
        {
          employeeId: 'employee-1',
          employeeCode: 'EMP001',
          fullName: 'Budi',
          branchName: 'Cabang Jakarta',
          departmentName: 'Operasional',
          counts: expect.objectContaining({ ON_TIME: 20, LATE: 2, totalWorkDurationMinutes: 9600 }),
        },
      ]);
    });
  });

  describe('getLeaveSummary', () => {
    it('menghitung sisa cuti (entitled + carriedOver - used) & jumlah pengajuan PENDING per karyawan', async () => {
      employeeRepository.findActiveByCompany.mockResolvedValue([
        { id: 'employee-1', employeeCode: 'EMP001', fullName: 'Budi' } as unknown as Employee,
      ]);
      leaveRepository.findBalancesByEmployee.mockResolvedValue([
        {
          entitledDays: '12.00',
          usedDays: '5.00',
          carriedOverDays: '2.00',
          leaveType: { name: 'Cuti Tahunan' },
        } as unknown as LeaveBalance,
      ]);
      leaveRepository.countByEmployeeAndStatus.mockResolvedValue(1);

      const result = await service.getLeaveSummary({ companyId: 'company-1', year: 2026 });

      expect(leaveRepository.countByEmployeeAndStatus).toHaveBeenCalledWith('employee-1', LeaveRequestStatus.PENDING);
      expect(result).toEqual([
        expect.objectContaining({
          leaveTypeName: 'Cuti Tahunan',
          entitledDays: 12,
          usedDays: 5,
          carriedOverDays: 2,
          remainingDays: 9,
          pendingRequestCount: 1,
        }),
      ]);
    });
  });

  describe('getPayrollSummary', () => {
    it('menjumlahkan seluruh payroll_items satu periode', async () => {
      payrollRepository.findPeriod.mockResolvedValue({
        id: 'period-1',
        periodMonth: 6,
        periodYear: 2026,
        status: PayrollPeriodStatus.GENERATED,
      } as PayrollPeriod);
      payrollRepository.findItemsByPeriod.mockResolvedValue([
        {
          grossSalary: '6000000.00',
          totalOvertime: '0.00',
          totalDeductionUnpaid: '0.00',
          bpjsCompanyTotal: '614400.00',
          bpjsEmployeeTotal: '240000.00',
          pph21Amount: '120000.00',
          netSalary: '5640000.00',
        } as unknown as PayrollItem,
        {
          grossSalary: '4070000.00',
          totalOvertime: '110000.00',
          totalDeductionUnpaid: '0.00',
          bpjsCompanyTotal: '416768.00',
          bpjsEmployeeTotal: '162800.00',
          pph21Amount: '81400.00',
          netSalary: '3825800.00',
        } as unknown as PayrollItem,
      ]);

      const result = await service.getPayrollSummary({ companyId: 'company-1', periodMonth: 6, periodYear: 2026 });

      expect(payrollRepository.findItemsByPeriod).toHaveBeenCalledWith('period-1');
      expect(result).toEqual({
        payrollPeriodId: 'period-1',
        periodMonth: 6,
        periodYear: 2026,
        status: PayrollPeriodStatus.GENERATED,
        employeeCount: 2,
        totalGrossSalary: 10_070_000,
        totalOvertime: 110_000,
        totalDeductionUnpaid: 0,
        totalBpjsCompany: 1_031_168,
        totalBpjsEmployee: 402_800,
        totalPph21: 201_400,
        totalNetSalary: 9_465_800,
      });
    });

    it('menolak dengan NotFoundException jika periode belum pernah digenerate', async () => {
      payrollRepository.findPeriod.mockResolvedValue(null);

      await expect(
        service.getPayrollSummary({ companyId: 'company-1', periodMonth: 6, periodYear: 2026 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(payrollRepository.findItemsByPeriod).not.toHaveBeenCalled();
    });
  });
});
