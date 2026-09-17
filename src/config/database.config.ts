import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { coreEntities } from '../database/entities';
import { authEntities } from '../modules/auth/entities';
import { employeeEntities } from '../modules/employee/entities';

/**
 * Satu-satunya tempat yang merakit opsi koneksi TypeORM, dipakai oleh:
 * - TypeOrmModule.forRootAsync() di app.module.ts (runtime aplikasi)
 * - src/database/data-source.ts (TypeORM CLI: migration:generate/run/revert)
 *
 * `synchronize` selalu dibaca dari env dan harus tetap `false` di semua
 * environment — perubahan skema hanya lewat file migration (§5).
 */
export function buildTypeOrmOptions(config: ConfigService): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.database'),
    schema: config.get<string>('database.schema'),
    ssl: config.get<boolean>('database.ssl'),
    synchronize: config.get<boolean>('database.synchronize'),
    logging: config.get<boolean>('database.logging'),
    namingStrategy: new SnakeNamingStrategy(),
    entities: [...coreEntities, ...authEntities, ...employeeEntities],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
    migrationsTableName: 'schema_migrations',
  };
}
