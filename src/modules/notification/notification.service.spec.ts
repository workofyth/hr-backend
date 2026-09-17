import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { IPayrollRepository } from '../payroll/payroll-repository.interface';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { Employee } from '../employee/entities/employee.entity';
import { AttendanceStatus } from '../attendance/entities/attendance.entity';
import { AttendanceCheckedInEvent } from '../attendance/events/attendance-checked-in.event';
import { LeaveRejectedEvent } from '../leave/events/leave-rejected.event';
import { PayrollGeneratedEvent } from '../payroll/events/payroll-generated.event';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: { create: jest.Mock; save: jest.Mock };
  let payrollRepository: jest.Mocked<IPayrollRepository>;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;

  beforeEach(() => {
    repository = { create: jest.fn((data) => data), save: jest.fn() };

    payrollRepository = {
      findSalaryComponents: jest.fn(),
      createSalaryComponent: jest.fn(),
      findActiveSalaryStructures: jest.fn(),
      findSalaryStructuresByEmployee: jest.fn(),
      findOpenSalaryStructure: jest.fn(),
      createSalaryStructure: jest.fn(),
      closeSalaryStructure: jest.fn(),
      findAllBpjsSettings: jest.fn(),
      createBpjsSetting: jest.fn(),
      findAllPtkpSettings: jest.fn(),
      createPtkpSetting: jest.fn(),
      findAllTerRates: jest.fn(),
      createTerRate: jest.fn(),
      findActiveBpjsSettings: jest.fn(),
      findPtkpSetting: jest.fn(),
      findTerRate: jest.fn(),
      findPeriodById: jest.fn(),
      findPeriods: jest.fn(),
      findPeriod: jest.fn(),
      createPeriod: jest.fn(),
      updatePeriod: jest.fn(),
      findItemsByPeriod: jest.fn(),
      findItemById: jest.fn(),
      findItemsByEmployeeAndYear: jest.fn(),
      createItem: jest.fn(),
      findItemDetails: jest.fn(),
      createItemDetail: jest.fn(),
      findPayslipByPayrollItem: jest.fn(),
      createPayslip: jest.fn(),
      findSeveranceCalculationsByEmployee: jest.fn(),
      createSeveranceCalculation: jest.fn(),
    };

    employeeRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeCode: jest.fn(),
      findFirstByCompanyAndRole: jest.fn(),
      findActiveByCompany: jest.fn(),
      findAllByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    service = new NotificationService(
      repository as unknown as Repository<Notification>,
      payrollRepository,
      employeeRepository,
    );
  });

  describe('handleAttendanceCheckedIn', () => {
    it('membuat notifikasi in-app untuk userId dari event', async () => {
      await service.handleAttendanceCheckedIn(
        new AttendanceCheckedInEvent('att-1', 'employee-1', 'user-1', new Date('2026-01-15T01:00:00Z'), AttendanceStatus.ON_TIME),
      );

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'ATTENDANCE_CHECKED_IN' }),
      );
    });

    it('tidak melempar error jika penulisan notifikasi gagal (best-effort)', async () => {
      repository.save.mockRejectedValue(new Error('DB down'));

      await expect(
        service.handleAttendanceCheckedIn(
          new AttendanceCheckedInEvent('att-1', 'employee-1', 'user-1', new Date(), AttendanceStatus.ON_TIME),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('handleLeaveRejected', () => {
    it('membuat notifikasi berisi rentang tanggal & alasan penolakan', async () => {
      await service.handleLeaveRejected(
        new LeaveRejectedEvent('req-1', 'employee-1', 'user-1', '2026-03-10', '2026-03-10', 'Tutup buku'),
      );

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'LEAVE_REJECTED',
          body: expect.stringContaining('Tutup buku'),
        }),
      );
    });

    it('tidak melempar error jika penulisan notifikasi gagal (best-effort)', async () => {
      repository.save.mockRejectedValue(new Error('DB down'));

      await expect(
        service.handleLeaveRejected(new LeaveRejectedEvent('req-1', 'employee-1', 'user-1', '2026-03-10', '2026-03-10', null)),
      ).resolves.not.toThrow();
    });
  });

  describe('handlePayrollGenerated', () => {
    it('membuat satu notifikasi per employee yang punya payroll_item pada periode ini', async () => {
      payrollRepository.findItemsByPeriod.mockResolvedValue([
        { employeeId: 'employee-1' } as PayrollItem,
        { employeeId: 'employee-2' } as PayrollItem,
      ]);
      employeeRepository.findById.mockImplementation((id) =>
        Promise.resolve({ id, userId: `user-of-${id}` } as Employee),
      );

      await service.handlePayrollGenerated(new PayrollGeneratedEvent('period-1', ['item-1', 'item-2']));

      expect(payrollRepository.findItemsByPeriod).toHaveBeenCalledWith('period-1');
      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-of-employee-1', type: 'PAYROLL_GENERATED' }),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-of-employee-2', type: 'PAYROLL_GENERATED' }),
      );
    });

    it('melewati item yang employee-nya tidak ditemukan tanpa melempar error', async () => {
      payrollRepository.findItemsByPeriod.mockResolvedValue([{ employeeId: 'employee-1' } as PayrollItem]);
      employeeRepository.findById.mockResolvedValue(null);

      await service.handlePayrollGenerated(new PayrollGeneratedEvent('period-1', ['item-1']));

      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
