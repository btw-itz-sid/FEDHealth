import { Controller, Post, Get, Patch, Body, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

const sessionOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1', maxAge: 24 * 60 * 60 * 1000 });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, req.ip);
    res.cookie('fedhealth_session', result.accessToken, sessionOptions());
    return { user: result.user };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, req.ip);
    res.cookie('fedhealth_session', result.accessToken, sessionOptions());
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('fedhealth_session', sessionOptions());
    return { success: true };
  }

  @Get('/users/me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: Request) {
    return this.authService.getProfile((req.user as any).id);
  }

  @Patch('/users/me/password')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.changePassword((req.user as any).id, dto, req.ip);
    res.cookie('fedhealth_session', result.accessToken, sessionOptions());
    return { success: true };
  }
}
