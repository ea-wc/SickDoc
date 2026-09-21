import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception.js';
import { ErrorCodes } from '@sickdoc/shared';
import { DomainEventsService } from '../common/events/domain-events.service.js';
import type { DomainEvent } from '../common/events/domain-events.types.js';
import { pageMeta, skipOf } from '../common/dto/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';

interface NotificationRow {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  appointmentId: string | null;
}

/** In-app notifications, written on domain events and polled by the client (§11). */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe((event) => {
      this.handleEvent(event).catch((error: unknown) => this.logger.error(String(error)));
    });
  }

  async list(userId: string, query: NotificationsQueryDto): Promise<{ data: object[]; meta: object }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = { userId, ...(query.unread ? { readAt: null } : {}) };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { data: rows, meta: { ...pageMeta(total, page, pageSize), unreadCount } };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    const rows = this.buildRows(event);
    if (rows.length > 0) {
      await this.prisma.notification.createMany({ data: rows });
    }
  }

  private buildRows(event: DomainEvent): NotificationRow[] {
    switch (event.type) {
      case 'appointment.booked': {
        const when = event.startsAt.toISOString();
        return [
          {
            userId: event.doctorUserId,
            type: NotificationType.APPOINTMENT_BOOKED,
            title: 'New appointment booked',
            body: `A patient booked an appointment at ${when}.`,
            appointmentId: event.appointmentId,
          },
          {
            userId: event.patientUserId,
            type: NotificationType.APPOINTMENT_BOOKED,
            title: 'Appointment confirmed',
            body: `Your appointment at ${when} is confirmed.`,
            appointmentId: event.appointmentId,
          },
        ];
      }
      case 'appointment.rescheduled': {
        const recipient = event.byRole === 'DOCTOR' ? event.patientUserId : event.doctorUserId;
        return [
          {
            userId: recipient,
            type: NotificationType.APPOINTMENT_RESCHEDULED,
            title: 'Appointment rescheduled',
            body: `An appointment was rescheduled to ${event.startsAt.toISOString()}.`,
            appointmentId: event.appointmentId,
          },
        ];
      }
      case 'appointment.cancelled': {
        const recipients =
          event.byRole === 'ADMIN'
            ? [event.patientUserId, event.doctorUserId]
            : event.byRole === 'DOCTOR'
              ? [event.patientUserId]
              : [event.doctorUserId];
        return recipients.map((userId) => ({
          userId,
          type: NotificationType.APPOINTMENT_CANCELLED,
          title: 'Appointment cancelled',
          body: 'An appointment was cancelled.',
          appointmentId: event.appointmentId,
        }));
      }
      case 'consultation.completed':
        return [
          {
            userId: event.patientUserId,
            type: NotificationType.CONSULTATION_READY,
            title: 'Consultation completed',
            body: 'Your consultation is complete. Your records are now available.',
            appointmentId: event.appointmentId,
          },
        ];
      case 'note.available':
        return [
          {
            userId: event.patientUserId,
            type: NotificationType.NOTE_AVAILABLE,
            title: 'New consultation note',
            body: 'Your doctor added a consultation note.',
            appointmentId: event.appointmentId,
          },
        ];
      case 'prescription.issued':
        return [
          {
            userId: event.patientUserId,
            type: NotificationType.PRESCRIPTION_ISSUED,
            title: 'New prescription',
            body: 'Your doctor issued a prescription.',
            appointmentId: event.appointmentId,
          },
        ];
      case 'schedule.changed':
        return event.patientUserIds.map((userId) => ({
          userId,
          type: NotificationType.SCHEDULE_CHANGED,
          title: 'Availability updated',
          body: "Your doctor's availability changed; an upcoming appointment may need to be rescheduled.",
          appointmentId: null,
        }));
    }
  }
}
