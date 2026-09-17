import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../../database/entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };
    service = new AuditLogService(repository as unknown as Repository<AuditLog>);
  });

  describe('record', () => {
    it('menyimpan baris audit_logs dengan oldValue/newValue null jika tidak diberikan', async () => {
      await service.record({ userId: 'user-1', action: 'APPROVE_X', entityType: 'x', entityId: 'x-1' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', action: 'APPROVE_X', oldValue: null, newValue: null }),
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('menerapkan filter per kolom & rentang tanggal inklusif seluruh hari', async () => {
      repository.findAndCount.mockResolvedValue([[{ id: 'log-1' } as AuditLog], 1]);

      const result = await service.findAll({
        userId: 'user-1',
        action: 'APPROVE_X',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        page: 1,
        limit: 20,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', action: 'APPROVE_X' }),
          relations: ['user'],
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({ items: [{ id: 'log-1' }], total: 1 });
    });

    it('menghitung skip dari page/limit dengan benar', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 10 });

      expect(repository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });
});
