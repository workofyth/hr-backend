import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../config/database.config';

/**
 * DataSource khusus untuk TypeORM CLI (migration:generate/run/revert).
 * Dijalankan lewat script "typeorm" di package.json, di luar konteks Nest DI,
 * sehingga env dimuat manual lalu dioper ke ConfigService yang sama dengan
 * yang dipakai app.module.ts — supaya opsi koneksi selalu konsisten.
 */
loadEnv();

const configService = new ConfigService({
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    schema: process.env.DB_SCHEMA ?? 'public',
    ssl: process.env.DB_SSL === 'true',
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  },
});

export default new DataSource(buildTypeOrmOptions(configService));
