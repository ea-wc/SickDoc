import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppointmentsService } from './appointments.service.js';
import { BookAppointmentDto, CancelAppointmentDto, ListAppointmentsQueryDto, RescheduleAppointmentDto } from './dto/appointment.dto.js';

/** Appointment lifecycle, scoped to the caller (docs/API_SPEC.md §7). */
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.CREATED)
  book(@CurrentUser() user: AuthenticatedUser, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.list(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.detail(user, id);
  }

  @Patch(':id/reschedule')
  reschedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(user, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(user, id, dto);
  }
}
