import { enumFilter, pagination } from '../../config/query-validation';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(options: { page?: number; limit?: number; role?: UserRole }) {
    const { page, limit } = pagination(options);
    enumFilter(options.role, UserRole, 'role');
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id', 'user.email', 'user.firstName', 'user.lastName',
        'user.role', 'user.isActive', 'user.createdAt', 'user.lastLoginAt',
      ])
      .orderBy('user.createdAt', 'DESC');

    if (options.role) {
      queryBuilder.andWhere('user.role = :role', { role: options.role });
    }

    const [items, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateRole(userId: string, newRole: UserRole, adminId: string) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const oldRole = user.role;
    user.role = newRole;
    await this.userRepository.save(user);

    await this.auditService.log({
      action: AuditAction.USER_ROLE_CHANGED,
      userId: adminId,
      resourceType: 'user',
      resourceId: userId,
      metadata: { oldRole, newRole },
    });

    return { id: user.id, email: user.email, role: user.role };
  }

  async deactivate(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.isActive = false;
    await this.userRepository.save(user);

    await this.auditService.log({
      action: AuditAction.USER_DEACTIVATED,
      userId: adminId,
      resourceType: 'user',
      resourceId: userId,
    });

    return { id: user.id, email: user.email, isActive: false };
  }

  async reactivate(userId: string, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.isActive = true;
    await this.userRepository.save(user);

    await this.auditService.log({
      action: AuditAction.ADMIN_ACTION,
      userId: adminId,
      resourceType: 'user',
      resourceId: userId,
      metadata: { action: 'reactivated' },
    });

    return { id: user.id, email: user.email, isActive: true };
  }
}
