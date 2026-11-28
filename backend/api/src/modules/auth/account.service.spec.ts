import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AccountService, recoveryKey } from './account.service';
import { UserRole, User } from '../users/entities/user.entity';
import { Prediction } from '../predictions/entities/prediction.entity';

describe('Recovery and personal data controls', () => {
  let users: any; let database: any; let service: AccountService; let user: any;
  beforeEach(async () => {
    user = { id: 'own-id', email: 'person@example.invalid', role: UserRole.PATIENT, isActive: true, passwordHash: await bcrypt.hash('CurrentPassword!', 4), recoveryCodeHash: recoveryKey().hash };
    users = { findOne: jest.fn(async () => ({ ...user })), update: jest.fn(async () => ({ affected: 1 })) };
    database = { getRepository: jest.fn(() => ({ delete: jest.fn() })), transaction: jest.fn() };
    service = new AccountService(users, database);
  });
  it.each([false, true])('rejects incorrect keys, including inactive account=%s', async inactive => {
    user.isActive = !inactive;
    await expect(service.recover({ email: user.email, recoveryCode: 'a'.repeat(64), newPassword: 'NextPassword!' })).rejects.toThrow('Email or recovery key');
    expect(users.update).not.toHaveBeenCalled();
  });
  it('consumes the old key atomically, changes the password, and rejects replay', async () => {
    const key = recoveryKey(); user.recoveryCodeHash = key.hash;
    const oldPasswordHash = user.passwordHash;
    const result = await service.recover({ email: ' PERSON@example.invalid ', recoveryCode: key.code, newPassword: 'NextPassword!' });
    const [where, saved] = users.update.mock.calls[0];
    expect(where).toEqual({ id: user.id, recoveryCodeHash: key.hash, passwordHash: oldPasswordHash });
    expect(await bcrypt.compare('NextPassword!', saved.passwordHash)).toBe(true);
    expect(saved.recoveryCodeHash).toBe(createHash('sha256').update(result.recoveryCode).digest('hex'));
    expect(result).not.toHaveProperty('passwordHash');
    users.update.mockResolvedValue({ affected: 0 });
    await expect(service.recover({ email: user.email, recoveryCode: key.code, newPassword: 'NextPassword!' })).rejects.toThrow('already been replaced');
    user.recoveryCodeHash = saved.recoveryCodeHash;
    await expect(service.recover({ email: user.email, recoveryCode: key.code, newPassword: 'NextPassword!' })).rejects.toThrow('Email or recovery key');
  });
  it('requires the current password for key rotation and history deletion', async () => {
    await expect(service.rotateRecoveryKey(user.id, 'wrong')).rejects.toThrow('Password is incorrect');
    await expect(service.clearHistory(user.id, 'wrong')).rejects.toThrow('Password is incorrect');
    expect(users.update).not.toHaveBeenCalled(); expect(database.getRepository).not.toHaveBeenCalled();
  });
  it('scopes history deletion to the signed-in user', async () => {
    const remove = jest.fn(); database.getRepository.mockReturnValue({ delete: remove });
    await service.clearHistory(user.id, 'CurrentPassword!');
    expect(database.getRepository).toHaveBeenCalledWith(Prediction);
    expect(remove).toHaveBeenCalledWith({ userId: user.id });
  });
  it('anonymizes security identifiers and deletes personal records transactionally', async () => {
    const query: any = {}; for (const name of ['update', 'set', 'where', 'execute']) query[name] = jest.fn(() => query);
    const manager = { createQueryBuilder: () => query, delete: jest.fn() };
    database.transaction.mockImplementation((run: any) => run(manager));
    await service.deletePersonalAccount(user.id, 'CurrentPassword!');
    expect(query.where).toHaveBeenCalledWith(expect.any(String), { userId: user.id, email: user.email });
    expect(query.set).toHaveBeenCalledWith(expect.objectContaining({ userEmail: expect.any(Function), ipAddress: expect.any(Function) }));
    expect(manager.delete.mock.calls).toEqual([[Prediction, { userId: user.id }], [User, { id: user.id }]]);
  });
  it.each([UserRole.ADMIN, UserRole.RESEARCHER])('requires review for %s deletion', async role => {
    user.role = role;
    await expect(service.deletePersonalAccount(user.id, 'CurrentPassword!')).rejects.toThrow('workspace operator');
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
