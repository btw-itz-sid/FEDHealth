import { Body, Controller, Delete, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountService } from './account.service';
import { ConfirmPasswordDto, RecoverAccountDto } from './dto/recovery.dto';

@Controller('auth')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Post('recover')
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  recover(@Body() dto: RecoverAccountDto) { return this.accounts.recover(dto); }

  @Post('users/me/recovery-key')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  rotate(@Req() req: Request, @Body() dto: ConfirmPasswordDto) {
    return this.accounts.rotateRecoveryKey((req.user as any).id, dto.password);
  }

  @Delete('users/me/history')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  clearHistory(@Req() req: Request, @Body() dto: ConfirmPasswordDto) {
    return this.accounts.clearHistory((req.user as any).id, dto.password);
  }

  @Delete('users/me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async deleteAccount(@Req() req: Request, @Body() dto: ConfirmPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.accounts.deletePersonalAccount((req.user as any).id, dto.password);
    res.clearCookie('fedhealth_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/v1' });
    return result;
  }
}
