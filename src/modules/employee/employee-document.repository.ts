import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { EmployeeDocument } from './entities/employee-document.entity';
import { IEmployeeDocumentRepository } from './employee-document-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `employee_documents` (§5.2).
 */
@Injectable()
export class EmployeeDocumentRepository implements IEmployeeDocumentRepository {
  constructor(
    @InjectRepository(EmployeeDocument)
    private readonly repository: Repository<EmployeeDocument>,
  ) {}

  findById(id: string): Promise<EmployeeDocument | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByEmployeeId(employeeId: string): Promise<EmployeeDocument[]> {
    return this.repository.find({ where: { employeeId }, order: { uploadedAt: 'DESC' } });
  }

  create(data: DeepPartial<EmployeeDocument>): Promise<EmployeeDocument> {
    const document = this.repository.create(data);
    return this.repository.save(document);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}
