import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:8081'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Global validation pipe
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
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
    .addBearerAuth()
    .addTag('Auth', 'Authentication and user management')
    .addTag('Predictions', 'Diabetes risk predictions')
    .addTag('Datasets', 'Research dataset management')
    .addTag('Experiments', 'ML experiment orchestration')
    .addTag('Models', 'Model registry')
    .addTag('Admin', 'Administration and audit')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`🏥 FedHealth API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
