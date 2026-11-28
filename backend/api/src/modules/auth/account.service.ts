import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Prediction } from '../predictions/entities/prediction.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { RecoverAccountDto } from './dto/recovery.dto';

export function recoveryKey() {
  const code = randomBytes(32).toString('hex');
  return { code, hash: createHash('sha256').update(code).digest('hex') };
}

@Injectable()
export class AccountService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, private readonly dataSource: DataSource) {}

  private async confirmPassword(userId: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Password is incorrect');
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.isActive || !await bcrypt.compare(password, user.passwordHash)) throw new BadRequestException('Password is incorrect');
    return user;
  }

  async rotateRecoveryKey(userId: string, password: string) {
    await this.confirmPassword(userId, password);
    const key = recoveryKey();
    await this.users.update(userId, { recoveryCodeHash: key.hash });
    return { recoveryCode: key.code };
  }

  async recover(dto: RecoverAccountDto) {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('Password must be at most 72 UTF-8 bytes');
    const user = await this.users.findOne({ where: { email: dto.email.trim().toLowerCase() }, select: { id: true, passwordHash: true, isActive: true, recoveryCodeHash: true } });
    const digest = createHash('sha256').update(dto.recoveryCode.toLowerCase()).digest();
    const stored = user?.recoveryCodeHash;
    if (!user?.isActive || !stored || !/^[a-f0-9]{64}$/.test(stored) || !timingSafeEqual(digest, Buffer.from(stored, 'hex'))) throw new BadRequestException('Email or recovery key is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const replacement = recoveryKey();
    // Consuming the old key and changing the password are one atomic write.
    const result = await this.users.update({ id: user.id, recoveryCodeHash: stored, passwordHash: user.passwordHash }, { passwordHash, recoveryCodeHash: replacement.hash });
    if (!result.affected) throw new BadRequestException('This recovery key has already been replaced');
    return { recoveryCode: replacement.code };
  }

  async clearHistory(userId: string, password: string) {
    await this.confirmPassword(userId, password);
    await this.dataSource.getRepository(Prediction).delete({ userId });
    return { success: true };
  }

  async deletePersonalAccount(userId: string, password: string) {
    const user = await this.confirmPassword(userId, password);
    if (user.role !== UserRole.PATIENT) throw new ForbiddenException('Research and administrator accounts must be reviewed by the workspace operator before deletion');
    await this.dataSource.transaction(async manager => {
      // Remove identifiers from retained security events. Do not erase shared
      // research datasets or models belonging to institutional accounts.
      await manager.createQueryBuilder().update(AuditLog).set({ userId: () => 'NULL', userEmail: () => 'NULL', resourceId: () => 'NULL', ipAddress: () => 'NULL' })
        .where('"userId" = :userId OR "userEmail" = :email', { userId, email: user.email }).execute();
      await manager.delete(Prediction, { userId });
      await manager.delete(User, { id: userId });
    });
    return { success: true };
  }
}
