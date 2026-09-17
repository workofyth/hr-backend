import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';

/**
 * Dipakai Docker HEALTHCHECK / load balancer / orchestrator (K8s, dsb) untuk
 * memastikan container benar-benar siap (bukan cuma proses Node hidup, tapi
 * juga koneksi database tersambung). Sengaja tanpa auth — endpoint infra,
 * bukan endpoint bisnis.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return {
      status: 'ok',
      database: this.dataSource.isInitialized ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
