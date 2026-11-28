import { browserSecurity } from './config/browser-security';
// Columns are `timestamp without time zone`; the pg driver reads and writes them
// in process-local time, so the process must run in UTC to round-trip correctly.
process.env.TZ = 'UTC';

import { Request, Response, NextFunction } from 'express';
import { serveFrontend } from './config/serve-frontend';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Account, recovery and assessment responses must not be cached.
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store'); next();
  });

  // Security
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"],
    frameAncestors: ["'none'"], formAction: ["'self'"],
  } } }));
  app.enableShutdownHooks();
  if (process.env.TRUST_PROXY === '1') app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const allowedOrigins = [...new Set([...(process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean), ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'])])];
  app.use(browserSecurity(allowedOrigins));
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-FedHealth-Client'],
  });

  // Global validation pipe
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('FedHealth API')
    .setDescription(
      'Backend API for the FedHealth Privacy-Preserving Diabetes Research Platform. ' +
      'Provides authentication, predictions, dataset management, experiment orchestration, ' +
      'model registry, and administration endpoints.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('fedhealth_session')
    .addTag('Auth', 'Authentication and user management')
    .addTag('Predictions', 'Diabetes risk predictions')
    .addTag('Datasets', 'Research dataset management')
    .addTag('Experiments', 'ML experiment orchestration')
    .addTag('Models', 'Model registry')
    .addTag('Admin', 'Administration and audit')
    .build();

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  if (process.env.SERVE_FRONTEND === 'true') {
    serveFrontend(app);
  }
  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`🏥 FedHealth API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
