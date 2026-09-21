import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ConsultationsService } from './consultations.service.js';

/** Consultation workspace and session transitions (docs/API_SPEC.md §8). */
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Get(':appointmentId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultationsService.getWorkspace(user, appointmentId);
  }

  @Post(':appointmentId/join')
  @HttpCode(HttpStatus.OK)
  join(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultationsService.join(user, appointmentId);
  }

  @Post(':appointmentId/start')
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultationsService.start(user, appointmentId);
  }

  @Post(':appointmentId/complete')
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultationsService.complete(user, appointmentId);
  }

  @Post(':appointmentId/no-show')
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  noShow(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultationsService.noShow(user, appointmentId);
  }
}
