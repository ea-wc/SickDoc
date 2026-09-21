import { Module } from '@nestjs/common';
import { AppointmentRecordsController, RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';

@Module({
  controllers: [AppointmentRecordsController, RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
