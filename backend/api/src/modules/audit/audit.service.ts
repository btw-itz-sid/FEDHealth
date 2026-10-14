import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(entry);
    return this.auditLogRepository.save(auditLog);
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    action?: AuditAction;
    userId?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC');

    if (options.action) {
      queryBuilder.andWhere('audit.action = :action', { action: options.action });
    }

    if (options.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: options.userId });
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
