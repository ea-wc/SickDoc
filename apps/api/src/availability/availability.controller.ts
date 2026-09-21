import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AvailabilityService } from './availability.service.js';
import { CreateAvailabilityExceptionDto, ReplaceAvailabilityRulesDto } from './dto/availability.dto.js';

/** Doctor self-service availability (docs/API_SPEC.md §10). */
@Controller('doctors/me/availability')
@Roles(Role.DOCTOR)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.availabilityService.resolveDoctorProfile(user.id);
    return this.availabilityService.getAvailability(profile.id);
  }

  @Put()
  async replace(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceAvailabilityRulesDto) {
    const profile = await this.availabilityService.resolveDoctorProfile(user.id);
    const { rules, conflicts, timezone } = await this.availabilityService.replaceRules(profile.id, dto);
    return { rules, timezone, meta: { conflicts } };
  }

  @Post('exceptions')
  @HttpCode(HttpStatus.CREATED)
  async addException(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAvailabilityExceptionDto) {
    const profile = await this.availabilityService.resolveDoctorProfile(user.id);
    return this.availabilityService.addException(profile.id, dto);
  }

  @Delete('exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteException(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const profile = await this.availabilityService.resolveDoctorProfile(user.id);
    await this.availabilityService.deleteException(profile.id, id);
  }
}
