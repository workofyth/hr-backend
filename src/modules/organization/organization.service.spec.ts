import { NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Company } from '../../database/entities/company.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Department } from '../../database/entities/department.entity';
import { Position } from '../../database/entities/position.entity';
import { Shift } from '../../database/entities/shift.entity';
import { Holiday } from '../../database/entities/holiday.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

function makeMockRepo(): MockRepo {
  return { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(), update: jest.fn() };
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  let companyRepo: MockRepo;
  let branchRepo: MockRepo;
  let departmentRepo: MockRepo;
  let positionRepo: MockRepo;
  let shiftRepo: MockRepo;
  let holidayRepo: MockRepo;

  beforeEach(() => {
    companyRepo = makeMockRepo();
    branchRepo = makeMockRepo();
    departmentRepo = makeMockRepo();
    positionRepo = makeMockRepo();
    shiftRepo = makeMockRepo();
    holidayRepo = makeMockRepo();

    service = new OrganizationService(
      companyRepo as unknown as jest.Mocked<import('typeorm').Repository<Company>>,
      branchRepo as unknown as jest.Mocked<import('typeorm').Repository<Branch>>,
      departmentRepo as unknown as jest.Mocked<import('typeorm').Repository<Department>>,
      positionRepo as unknown as jest.Mocked<import('typeorm').Repository<Position>>,
      shiftRepo as unknown as jest.Mocked<import('typeorm').Repository<Shift>>,
      holidayRepo as unknown as jest.Mocked<import('typeorm').Repository<Holiday>>,
    );
  });

  describe('branch', () => {
    it('createBranch mengonversi latitude/longitude number ke string presisi-7 (kolom decimal(10,7))', async () => {
      branchRepo.save.mockResolvedValue({ id: 'branch-1' });

      await service.createBranch({
        companyId: 'company-1',
        name: 'Cabang Bandung',
        latitude: -6.914744,
        longitude: 107.60981,
        radiusMeters: 150,
      });

      expect(branchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: '-6.9147440', longitude: '107.6098100', radiusMeters: 150 }),
      );
    });

    it('updateBranch menolak dengan NotFoundException jika id tidak ada', async () => {
      branchRepo.findOne.mockResolvedValue(null);

      await expect(service.updateBranch('missing-id', { name: 'Baru' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(branchRepo.update).not.toHaveBeenCalled();
    });

    it('updateBranch hanya mengirim field yang benar-benar diisi (partial update)', async () => {
      branchRepo.findOne.mockResolvedValue({ id: 'branch-1' });

      await service.updateBranch('branch-1', { name: 'Nama Baru' });

      expect(branchRepo.update).toHaveBeenCalledWith('branch-1', { name: 'Nama Baru' });
    });
  });

  describe('shift', () => {
    it('findShifts memfilter by companyId jika diberikan', async () => {
      shiftRepo.find.mockResolvedValue([]);
      await service.findShifts('company-1');
      expect(shiftRepo.find).toHaveBeenCalledWith({ where: { companyId: 'company-1' }, order: { name: 'ASC' } });
    });

    it('findShifts tanpa companyId mengambil semua', async () => {
      shiftRepo.find.mockResolvedValue([]);
      await service.findShifts();
      expect(shiftRepo.find).toHaveBeenCalledWith({ where: {}, order: { name: 'ASC' } });
    });

    it('createShift menyimpan shift baru', async () => {
      shiftRepo.save.mockResolvedValue({ id: 'shift-1' });
      await service.createShift({
        companyId: 'company-1',
        name: 'Shift Malam',
        startTime: '22:00',
        endTime: '06:00',
        toleranceMinutes: 10,
      });
      expect(shiftRepo.create).toHaveBeenCalled();
      expect(shiftRepo.save).toHaveBeenCalled();
    });

    it('updateShift menolak dengan NotFoundException jika id tidak ada', async () => {
      shiftRepo.findOne.mockResolvedValue(null);
      await expect(service.updateShift('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('holiday', () => {
    it('createHoliday menyimpan hari libur baru', async () => {
      holidayRepo.save.mockResolvedValue({ id: 'holiday-1' });
      await service.createHoliday({
        companyId: 'company-1',
        date: '2026-01-01',
        name: 'Tahun Baru',
        isNational: true,
      });
      expect(holidayRepo.save).toHaveBeenCalled();
    });

    it('updateHoliday menolak dengan NotFoundException jika id tidak ada', async () => {
      holidayRepo.findOne.mockResolvedValue(null);
      await expect(service.updateHoliday('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('company/department/position — NotFoundException saat update id tidak ada', () => {
    it('updateCompany', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      await expect(service.updateCompany('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateDepartment', async () => {
      departmentRepo.findOne.mockResolvedValue(null);
      await expect(service.updateDepartment('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updatePosition', async () => {
      positionRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePosition('missing', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
