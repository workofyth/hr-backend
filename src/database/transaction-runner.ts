import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');

/**
 * Unit of Work — backend-architecture-hr.md §3: "Pastikan operasi
 * multi-tabel bersifat atomic (semua sukses atau semua rollback)".
 * Dipakai Service yang perlu menulis ke lebih dari satu tabel dalam satu
 * transaksi (mis. EmployeeService.create() menulis ke `users` & `employees`).
 */
export interface TransactionRunner {
  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
}

@Injectable()
export class TypeOrmTransactionRunner implements TransactionRunner {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }
}
