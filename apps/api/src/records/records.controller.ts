import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateNoteDto, CreatePrescriptionDto, RecordsQueryDto, UpdateNoteDto } from './dto/record.dto.js';
import { RecordsService } from './records.service.js';

/** Per-appointment clinical records (docs/API_SPEC.md §9). */
@Controller('appointments')
export class AppointmentRecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post(':id/note')
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.CREATED)
  createNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateNoteDto) {
    return this.recordsService.createNote(user, id, dto);
  }

  @Patch(':id/note')
  @Roles(Role.DOCTOR)
  updateNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.recordsService.updateNote(user, id, dto);
  }

  @Get(':id/note')
  getNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recordsService.getNote(user, id);
  }

  @Post(':id/prescriptions')
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.CREATED)
  createPrescription(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreatePrescriptionDto) {
    return this.recordsService.createPrescription(user, id, dto);
  }
}

/** Patient/doctor record timelines (docs/API_SPEC.md §9). */
@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get('me')
  @Roles(Role.PATIENT)
  myRecords(@CurrentUser() user: AuthenticatedUser, @Query() query: RecordsQueryDto) {
    return this.recordsService.recordsForPatient(user, query);
  }

  @Get('patients/:patientId')
  @Roles(Role.DOCTOR)
  patientRecords(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.recordsService.recordsForPatientByDoctor(user, patientId);
  }
}
