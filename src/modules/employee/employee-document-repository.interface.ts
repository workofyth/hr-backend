import { DeepPartial } from 'typeorm';
import { EmployeeDocument } from './entities/employee-document.entity';

/**
 * Repository Pattern untuk tabel `employee_documents` (§5.2) — dipisah dari
 * IEmployeeRepository (Interface Segregation, §3) karena siklus hidup
 * upload/hapus dokumen berbeda dari data inti karyawan.
 */
export interface IEmployeeDocumentRepository {
  findById(id: string): Promise<EmployeeDocument | null>;
  findByEmployeeId(employeeId: string): Promise<EmployeeDocument[]>;
  create(data: DeepPartial<EmployeeDocument>): Promise<EmployeeDocument>;
  softDelete(id: string): Promise<void>;
}
