import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    // Check for existing user
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Create user
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role || UserRole.PATIENT,
    });

    const savedUser = await this.userRepository.save(user);

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_REGISTERED,
      userId: savedUser.id,
      userEmail: savedUser.email,
      resourceType: 'user',
      resourceId: savedUser.id,
      ipAddress,
    });

    const token = this.generateToken(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      accessToken: token,
    };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      await this.auditService.log({
        action: AuditAction.USER_LOGIN_FAILED,
        userEmail: dto.email.toLowerCase(),
        metadata: { reason: 'User not found' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditService.log({
        action: AuditAction.USER_LOGIN_FAILED,
        userId: user.id,
        userEmail: user.email,
        metadata: { reason: 'Invalid password' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_LOGIN,
      userId: user.id,
      userEmail: user.email,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
    });

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      accessToken: token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      consentGiven: user.consentGiven,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
