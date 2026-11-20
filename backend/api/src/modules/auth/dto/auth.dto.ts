import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'patient@fedhealth.dev' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    enum: [UserRole.PATIENT],
    default: UserRole.PATIENT,
    description: 'Research and admin access requires administrator approval',
  })
  @IsOptional()
  @IsIn([UserRole.PATIENT], {
    message: 'Research access must be granted by an administrator',
  })
  role?: UserRole;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class LoginDto {
  @ApiProperty({ example: 'patient@fedhealth.dev' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
}
