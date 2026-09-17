import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseTransformerInterceptor } from './common/interceptors/response-transformer.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Versioning API sejak awal — backend-architecture-hr.md §4.
  // /admin (Admin Dashboard statis) & /api/docs (Swagger) sengaja di luar
  // prefix ini.
  app.setGlobalPrefix('api/v1', {
    exclude: ['admin', 'admin/(.*)', 'api/docs', 'api/docs/(.*)', 'api/docs-json'],
  });

  // DTO + validasi konsisten & response format standar — §4.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new ResponseTransformerInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('HR Backend API')
      .setDescription('Aplikasi HR Mandiri — Absensi Radius, Cuti, Payroll (sesuai UU Indonesia)')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

bootstrap();
