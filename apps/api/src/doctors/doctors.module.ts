import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { DoctorsController, SpecializationsController } from './doctors.controller.js';
import { DoctorsService } from './doctors.service.js';

@Module({
  imports: [AvailabilityModule],
  controllers: [SpecializationsController, DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
