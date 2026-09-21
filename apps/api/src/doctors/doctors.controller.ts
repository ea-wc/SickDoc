import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { DoctorSearchQueryDto, DoctorSlotsQueryDto } from './dto/doctor-query.dto.js';
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
