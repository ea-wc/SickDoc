import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { MatchingController, SymptomsController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [AvailabilityModule],
  controllers: [SymptomsController, MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
