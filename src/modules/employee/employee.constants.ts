import { mkdirSync } from 'fs';
import { join } from 'path';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');
export const EMPLOYEE_DOCUMENT_REPOSITORY = Symbol('EMPLOYEE_DOCUMENT_REPOSITORY');

/**
 * Direktori disk lokal untuk dokumen karyawan (roadmap Phase 1: "Upload
 * dokumen karyawan"). Belum ada kredensial S3/MinIO — penyederhanaan yang
 * disengaja & didokumentasikan (lihat README modul ini). Volume Docker
 * `employee_documents` (docker-compose.yml) supaya tidak hilang saat
 * container di-rebuild.
 */
export const EMPLOYEE_DOCUMENTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'employee-documents');
mkdirSync(EMPLOYEE_DOCUMENTS_UPLOAD_DIR, { recursive: true });
