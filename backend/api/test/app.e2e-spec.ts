/**
 * FedHealth API — E2E Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('FedHealth API (e2e)', () => {
  let app: INestApplication;

  // Skip if no DATABASE_URL (CI-safe)
  const skip = !process.env.DATABASE_URL;

  beforeAll(async () => {
    if (skip) return;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/health should return OK', async () => {
    if (skip) return;

    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('POST /api/v1/auth/register should create user', async () => {
    if (skip) return;

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `test${Date.now()}@fedhealth.dev`,
        password: 'TestPass123!',
        firstName: 'E2E',
        lastName: 'Test',
        role: 'patient',
      })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toHaveProperty('email');
  });

  it('POST /api/v1/auth/login should reject bad credentials', async () => {
    if (skip) return;

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'wrong' })
      .expect(401);
  });
});
