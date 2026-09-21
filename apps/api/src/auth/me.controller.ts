import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthService, MeResponse } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

/**
 * Self-service endpoints for the authenticated caller (docs/API_SPEC.md §3).
 * Not public — the global bearer guard applies.
 */
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.me(user.id);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.changePassword(user.id, dto);
  }
}
