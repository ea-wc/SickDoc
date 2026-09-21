import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { DoctorSearchQueryDto, DoctorSlotsQueryDto } from './dto/doctor-query.dto.js';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto.js';
import { DoctorsService } from './doctors.service.js';

@Controller('specializations')
export class SpecializationsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Public()
  list() {
    return this.doctorsService.listSpecializations();
  }
}

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Public()
  search(@Query() query: DoctorSearchQueryDto) {
    return this.doctorsService.search(query);
  }

  @Get('me')
  @Roles(Role.DOCTOR)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.doctorsService.getMe(user.id);
  }

  @Patch('me')
  @Roles(Role.DOCTOR)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateDoctorProfileDto) {
    return this.doctorsService.updateMe(user.id, dto);
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string) {
    return this.doctorsService.getDoctor(id);
  }

  @Get(':id/slots')
  @Public()
  slots(@Param('id') id: string, @Query() query: DoctorSlotsQueryDto) {
    return this.doctorsService.getSlots(id, query.from, query.to);
  }
}
