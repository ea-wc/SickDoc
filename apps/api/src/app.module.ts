import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { CommonModule } from './common/common.module.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { HealthModule } from './health/health.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecordsModule } from './records/records.module.js';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    AvailabilityModule,
    DoctorsModule,
    PatientsModule,
    MatchingModule,
    AppointmentsModule,
    ConsultationsModule,
    RecordsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
