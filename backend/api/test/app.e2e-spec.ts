/** Isolated HTTP tests. No application database or live users are touched. */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AccountController } from '../src/modules/auth/account.controller';
import { AccountService } from '../src/modules/auth/account.service';
import { DataSource } from 'typeorm';
import { serveFrontend } from '../src/config/serve-frontend';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { User } from '../src/modules/users/entities/user.entity';
import { AuditService } from '../src/modules/audit/audit.service';
import { browserSecurity } from '../src/config/browser-security';

jest.setTimeout(60000);

describe('Cookie sessions over HTTP', () => {
  let app: INestApplication;
  let base: string;
  let cookie: string;
  let recoveryCode: string;
  let directory: string;
  const users: any[] = [];
  const signingKey = randomUUID();
  const password = randomUUID();
  const email = 'isolated-test@example.org';
  const headers = { 'Content-Type': 'application/json', 'X-FedHealth-Client': 'web' };
  const repository = {
    findOne: jest.fn(async ({ where }: any) => users.find(user => Object.entries(where).every(([key, value]) => user[key] === value)) || null),
    update: async (where: any, patch: any) => { const match = users.find(user => typeof where === 'string' ? user.id === where : Object.entries(where).every(([key, value]) => user[key] === value)); if (!match) return { affected: 0 }; Object.assign(match, patch); return { affected: 1 }; },
    create: (value: any) => ({ id: randomUUID(), isActive: true, ...value }),
    save: async (value: any) => { if (!users.includes(value)) users.push(value); return value; },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({ secret: signingKey, signOptions: { expiresIn: '1h' } })],
      controllers: [AuthController, AccountController],
      providers: [AuthService, AccountService, JwtStrategy, JwtAuthGuard,
        { provide: DataSource, useValue: { getRepository: () => ({ delete: async () => undefined }) } },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: signingKey }) },
        { provide: getRepositoryToken(User), useValue: repository },
        { provide: AuditService, useValue: { log: async () => undefined } }],
    }).compile();
    app = module.createNestApplication();
    directory = await mkdtemp(join(tmpdir(), 'fedhealth-web-'));
    await writeFile(join(directory, 'index.html'), '<html>FedHealth staging test</html>');
    serveFrontend(app as NestExpressApplication, directory);
    app.setGlobalPrefix('api/v1');
    app.use(browserSecurity(['http://localhost:5173']));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
  });
  afterAll(async () => { await app?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
  it('registers with an HttpOnly cookie and no token in JSON', async () => {
    const response = await fetch(`${base}/auth/register`, { method: 'POST', headers, body: JSON.stringify({ email, password, firstName: 'Test', lastName: 'User' }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    recoveryCode = data.recoveryCode;
    expect(recoveryCode).toMatch(/^[a-f0-9]{64}$/);
    expect(data.user.recoveryCodeHash).toBeUndefined();
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.role).toBe('patient'); expect(data.accessToken).toBeUndefined();
    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly'); expect(setCookie).toContain('SameSite=Strict');
    cookie = setCookie.split(';')[0];
    expect((await fetch(`${base}/auth/users/me`, { headers: { Cookie: cookie } })).status).toBe(200);
  });
  it('blocks public researcher registration and foreign-origin mutations', async () => {
    const response = await fetch(`${base}/auth/register`, { method: 'POST', headers, body: JSON.stringify({ email: 'staff@example.org', password, firstName: 'Test', lastName: 'User', role: 'researcher' }) });
    expect(response.status).toBe(400);
    expect((await fetch(`${base}/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: cookie, Origin: 'https://foreign.example.org' } })).status).toBe(403);
  });
  it('requires request verification for cookie-authenticated mutations', async () => {
    expect((await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Cookie: cookie } })).status).toBe(403);
  });
  it('rotates the cookie on password change and invalidates the earlier session', async () => {
    const response = await fetch(`${base}/auth/users/me/password`, { method: 'PATCH', headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ currentPassword: password, newPassword: randomUUID() }) });
    expect(response.status).toBe(200);
    const freshCookie = response.headers.get('set-cookie')!.split(';')[0];
    expect((await fetch(`${base}/auth/users/me`, { headers: { Cookie: cookie } })).status).toBe(401);
    expect((await fetch(`${base}/auth/users/me`, { headers: { Cookie: freshCookie } })).status).toBe(200);
    cookie = freshCookie;
  });
  it('serves frontend deep links while keeping API errors as API errors', async () => {
    const page = await fetch(base.replace('/api/v1', '/login'));
    expect(page.status).toBe(200); expect(await page.text()).toContain('FedHealth staging test');
    const missing = await fetch(`${base}/unknown-route`);
    expect(missing.status).toBe(404); expect(missing.headers.get('content-type')).toContain('application/json');
  });
  it('validates recovery input and protects personal data endpoints', async () => {
    const invalid = await fetch(`${base}/auth/recover`, { method: 'POST', headers, body: JSON.stringify({ email, recoveryCode: 'bad', newPassword: 'short' }) });
    expect(invalid.status).toBe(400);
    expect((await fetch(`${base}/auth/users/me/history`, { method: 'DELETE', headers, body: JSON.stringify({ password }) })).status).toBe(401);
  });
  it('recovers without email delivery, invalidates sessions, and refuses the old key', async () => {
    const response = await fetch(`${base}/auth/recover`, { method: 'POST', headers, body: JSON.stringify({ email, recoveryCode, newPassword: randomUUID() }) });
    expect(response.status).toBe(201);
    const replacement = await response.json(); expect(replacement.recoveryCode).toMatch(/^[a-f0-9]{64}$/);
    expect((await fetch(`${base}/auth/users/me`, { headers: { Cookie: cookie } })).status).toBe(401);
    const replay = await fetch(`${base}/auth/recover`, { method: 'POST', headers, body: JSON.stringify({ email, recoveryCode, newPassword: randomUUID() }) });
    expect(replay.status).toBe(400);
  });
});
