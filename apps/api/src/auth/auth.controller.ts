import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthResponse } from '@sickdoc/shared';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthResult, AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import { RegisterPatientDto } from './dto/register-patient.dto.js';
import { AUTH_THROTTLE } from './throttle.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, TokenService } from './token.service.js';

type CookieRequest = Request & { cookies?: Record<string, string> };

/**
 * Public auth endpoints (docs/API_SPEC.md §3). Rate limited to 10 attempts per
 * 15 minutes, keyed by IP plus the submitted email.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register/patient')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async registerPatient(@Body() dto: RegisterPatientDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.authService.registerPatient(dto);
    this.setRefreshCookie(res, result);
    return this.toAuthResponse(result);
  }

  @Post('register/doctor')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async registerDoctor(@Body() dto: RegisterDoctorDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.authService.registerDoctor(dto);
    this.setRefreshCookie(res, result);
    return this.toAuthResponse(result);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result);
    return this.toAuthResponse(result);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.authService.refresh(this.readCookie(req));
    this.setRefreshCookie(res, result);
    return this.toAuthResponse(result);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(this.readCookie(req));
    this.clearRefreshCookie(res);
  }

  private setRefreshCookie(res: Response, result: AuthResult): void {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: REFRESH_COOKIE_PATH,
      expires: result.refreshExpiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private readCookie(req: CookieRequest): string | undefined {
    return req.cookies?.[REFRESH_COOKIE];
  }

  private toAuthResponse(result: AuthResult): AuthResponse {
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }
}
