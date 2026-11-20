import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('Session invalidation', () => {
  const user = { id: 'id', passwordHash: 'test-only-password-hash', isActive: true, role: 'patient' };
  const repository = { findOne: jest.fn() };
  const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: 'test-only-signing-key' }), repository as any);
  beforeEach(() => repository.findOne.mockResolvedValue({ ...user }));
  it('uses the current database role and requires the current password version', async () => {
    const payload = { sub: 'id', email: '', role: 'admin', credentialVersion: createHash('sha256').update(user.passwordHash).digest('hex') };
    expect((await strategy.validate(payload)).role).toBe('patient');
    repository.findOne.mockResolvedValue({ ...user, passwordHash: 'changed-hash' });
    await expect(strategy.validate(payload)).rejects.toThrow('Invalid');
  });
  it('rejects legacy tokens and deactivated accounts', async () => {
    await expect(strategy.validate({ sub: 'id' } as any)).rejects.toThrow('Invalid');
    repository.findOne.mockResolvedValue({ ...user, isActive: false });
    await expect(strategy.validate({ sub: 'id' } as any)).rejects.toThrow('Invalid');
  });
});
