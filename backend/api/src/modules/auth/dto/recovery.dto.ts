import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordDto {
  @IsString()
  @MaxLength(128)
  password: string;
}

export class RecoverAccountDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  recoveryCode: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
