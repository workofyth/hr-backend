import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseTransformerInterceptor } from './common/interceptors/response-transformer.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Versioning API sejak awal — backend-architecture-hr.md §4.
  app.setGlobalPrefix('api/v1');

  // DTO + validasi konsisten & response format standar — §4.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new ResponseTransformerInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

bootstrap();
