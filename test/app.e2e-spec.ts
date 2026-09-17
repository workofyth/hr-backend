import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseTransformerInterceptor } from '../src/common/interceptors/response-transformer.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Smoke test terhadap DATABASE SUNGGUHAN (bukan mock) — bukan sekadar
 * "endpoint ada", tapi "endpoint tidak 500 karena entity/DataSource salah
 * konfigurasi". Ini KELAS BUG yang tidak mungkin tertangkap oleh unit test
 * ber-mock-repository (lihat test-plan-hr.md §2): setiap module.spec.ts
 * mock total repository-nya, jadi TypeORM DataSource asli tidak pernah
 * benar-benar disentuh sampai app berjalan sungguhan.
 *
 * Precondition (lihat README): Postgres dari `docker-compose.yml` harus
 * jalan (host port sesuai `DB_PORT` di environment saat test ini
 * dijalankan — BUKAN otomatis dari `.env`, lihat script `test:e2e` di
 * package.json) dan migration sudah dijalankan (`npm run migration:run`).
 * Belum ada database test terisolasi (§2.2 test-plan-hr.md) — test ini
 * baca-saja (GET) terhadap DB dev supaya aman dijalankan berulang.
 */
describe('Smoke test — endpoint lintas modul tidak 500 di atas DB sungguhan (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalInterceptors(new ResponseTransformerInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    jwtService = app.get(JwtService);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health mengembalikan 200 tanpa autentikasi', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  /**
   * userId acak (tidak perlu benar-benar ada di tabel users) — cukup untuk
   * lolos JwtAuthGuard/RolesGuard. Query di bawah tidak butuh baris nyata,
   * hanya membuktikan repository berhasil menjangkau DataSource (tidak 500
   * "No metadata for ... was found").
   */
  function tokenFor(role: string): string {
    return jwtService.sign({ sub: '00000000-0000-0000-0000-000000000000', role });
  }

  const casesThatMustNotBe500: Array<{ label: string; path: string; role: string }> = [
    { label: 'attendance corrections queue', path: '/api/v1/attendance/corrections/pending', role: 'HR_ADMIN' },
    { label: 'attendance overtime queue', path: '/api/v1/attendance/overtime/pending', role: 'HR_ADMIN' },
    { label: 'attendance shift assignments', path: '/api/v1/attendance/shift-assignments?employeeId=00000000-0000-0000-0000-000000000001', role: 'HR_ADMIN' },
    { label: 'leave types', path: '/api/v1/leave-types', role: 'HR_ADMIN' },
    { label: 'payroll bpjs settings', path: '/api/v1/payroll/bpjs-settings', role: 'HR_ADMIN' },
    { label: 'payroll periods', path: '/api/v1/payroll/periods?companyId=00000000-0000-0000-0000-000000000001', role: 'HR_ADMIN' },
    { label: 'audit logs', path: '/api/v1/audit-logs', role: 'HR_ADMIN' },
    { label: 'employees list', path: '/api/v1/employees', role: 'HR_ADMIN' },
  ];

  it.each(casesThatMustNotBe500)('$label tidak melempar 500 (Internal Server Error)', async ({ path, role }) => {
    const response = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${tokenFor(role)}`);

    expect(response.status).toBeLessThan(500);
  });
});
