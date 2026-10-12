/**
 * FedHealth API — Auth Module Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockJwtService: any;
  let mockAuditService: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
      signAsync: jest.fn().mockResolvedValue('test-jwt-token'),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue(null); // no existing user

      const hashedPw = await bcrypt.hash('TestPass123!', 12);
      const mockUser = {
        id: 'test-uuid',
        email: 'test@fedhealth.dev',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.PATIENT,
        passwordHash: hashedPw,
        isActive: true,
      };

      mockUserRepo.create.mockReturnValue(mockUser);
      mockUserRepo.save.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@fedhealth.dev',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.PATIENT,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('test@fedhealth.dev');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'existing@fedhealth.dev',
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User',
          role: UserRole.PATIENT,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
