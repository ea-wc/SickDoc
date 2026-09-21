import { Injectable } from '@nestjs/common';
import { AppointmentStatus, CancelledBy, DoctorStatus, Prisma, Role, SessionStatus, UserStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { DomainEventsService } from '../common/events/domain-events.service.js';
import { pageMeta, skipOf } from '../common/dto/pagination-query.dto.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasAppointmentConflict, validateBookingWindow } from './conflicts.js';
import { BookAppointmentDto, CancelAppointmentDto, ListAppointmentsQueryDto, RescheduleAppointmentDto } from './dto/appointment.dto.js';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
];

const JOIN_WINDOW_BEFORE_MINUTES = 10;

const listInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
  doctor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      avatarColor: true,
      specializations: { include: { specialization: true }, where: { isPrimary: true } },
    },
  },
  session: { select: { id: true, status: true } },
  note: { select: { id: true } },
  prescriptions: { select: { id: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof listInclude }>;

function nameOf(first: string, last: string, title?: string | null): string {
  return [title, first, last].filter(Boolean).join(' ');
}

function initialsOf(name: string): string {
  const parts = name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** Booking, rescheduling, cancellation, and scoped listing (docs/API_SPEC.md §7). */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly events: DomainEventsService,
  ) {}

  async book(user: AuthenticatedUser, dto: BookAppointmentDto): Promise<object> {
    const patientProfile = await this.patientProfileFor(user.id);
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id: dto.doctorId },
      include: { user: { select: { id: true, status: true } } },
    });
    if (!doctor) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Doctor not found');
    }
    if (doctor.status !== DoctorStatus.APPROVED) {
      throw new AppException(ErrorCodes.DOCTOR_NOT_APPROVED, 'This doctor is not yet approved');
    }
    if (doctor.user.status !== UserStatus.ACTIVE) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'This doctor is not accepting bookings');
    }

    const startsAt = new Date(dto.startsAt);
    const window = validateBookingWindow({ startsAt, now: new Date() });
    if (!window.ok) {
      throw new AppException(window.code, window.message);
    }

    const { slot } = await this.availability.slotAt(doctor.id, startsAt);
    if (!slot || !slot.available) {
      throw new AppException(ErrorCodes.SLOT_UNAVAILABLE, 'That time is no longer available', [
        { field: 'startsAt', issue: 'conflicts with an existing appointment or schedule' },
      ]);
    }
    const endsAt = slot.endsAt;

    const appointment = await this.createAppointment({
      patientProfileId: patientProfile.id,
      doctorProfileId: doctor.id,
      startsAt,
      endsAt,
      reason: dto.reason,
      symptomIds: dto.symptomIds ?? [],
      patientUserId: patientProfile.userId,
      doctorUserId: doctor.user.id,
    });

    return this.detail(user, appointment.id);
  }

  async list(user: AuthenticatedUser, query: ListAppointmentsQueryDto): Promise<{ data: object[]; meta: object }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = query.scope ?? 'upcoming';
    const now = new Date();

    const where = await this.scopeWhere(user);
    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }
    const startsAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      startsAtFilter.gte = new Date(query.from);
    }
    if (query.to) {
      startsAtFilter.lte = new Date(query.to);
    }
    if (scope === 'upcoming') {
      startsAtFilter.gte = now;
    } else if (scope === 'past') {
      startsAtFilter.lt = now;
    }
    if (Object.keys(startsAtFilter).length > 0) {
      where.startsAt = startsAtFilter;
    }

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: listInclude,
        orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data: rows.map((row) => this.toCard(row)), meta: pageMeta(total, page, pageSize) };
  }

  async detail(user: AuthenticatedUser, id: string): Promise<object> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, userId: true, firstName: true, lastName: true, avatarColor: true } },
        doctor: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            title: true,
            avatarColor: true,
            specializations: { include: { specialization: true }, where: { isPrimary: true } },
          },
        },
        session: { select: { id: true, status: true, patientJoinedAt: true, doctorJoinedAt: true, startedAt: true, endedAt: true } },
        note: true,
        prescriptions: { include: { items: true }, orderBy: { issuedAt: 'desc' } },
      },
    });
    if (!appointment) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }

    const relationship = this.relationshipOf(user, appointment);
    if (relationship === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }

    const canSeeRecords = relationship === 'doctor' || appointment.session?.status === SessionStatus.COMPLETED;
    return this.toDetail(appointment, canSeeRecords);
  }

  async reschedule(user: AuthenticatedUser, id: string, dto: RescheduleAppointmentDto): Promise<object> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, userId: true } },
        doctor: { select: { id: true, userId: true, user: { select: { id: true, status: true } } } },
        session: true,
      },
    });
    if (!appointment) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }
    const relationship = this.relationshipOf(user, appointment);
    if (relationship === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }
    if (appointment.status !== AppointmentStatus.CONFIRMED && appointment.status !== AppointmentStatus.PENDING) {
      throw new AppException(ErrorCodes.INVALID_STATE_TRANSITION, 'Only confirmed appointments can be rescheduled');
    }

    const startsAt = new Date(dto.startsAt);
    const window = validateBookingWindow({ startsAt, now: new Date() });
    if (!window.ok) {
      throw new AppException(window.code, window.message);
    }

    const { slot } = await this.availability.slotAt(appointment.doctorProfileId, startsAt);
    if (!slot || !slot.available) {
      throw new AppException(ErrorCodes.SLOT_UNAVAILABLE, 'That time is no longer available', [
        { field: 'startsAt', issue: 'conflicts with an existing appointment or schedule' },
      ]);
    }
    const endsAt = slot.endsAt;

    // Patient must not double-book (the appointment being rescheduled is excluded).
    const existing = await this.prisma.appointment.findMany({
      where: {
        patientProfileId: appointment.patientProfileId,
        id: { not: appointment.id },
        status: { in: ACTIVE_STATUSES },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (hasAppointmentConflict(existing, startsAt, endsAt)) {
      throw new AppException(ErrorCodes.PATIENT_DOUBLE_BOOKED, 'You already have an appointment at this time');
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.RESCHEDULED },
        });
        const next = await tx.appointment.create({
          data: {
            patientProfileId: appointment.patientProfileId,
            doctorProfileId: appointment.doctorProfileId,
            startsAt,
            endsAt,
            status: AppointmentStatus.CONFIRMED,
            reason: appointment.reason,
            symptomIds: appointment.symptomIds,
            rescheduledFromId: appointment.id,
          },
        });
        await tx.consultationSession.create({
          data: { appointmentId: next.id, status: SessionStatus.SCHEDULED },
        });
        return next;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.events.emit({
      type: 'appointment.rescheduled',
      appointmentId: created.id,
      patientUserId: appointment.patient.userId,
      doctorUserId: appointment.doctor.userId,
      startsAt,
      byRole: relationship === 'doctor' ? 'DOCTOR' : 'PATIENT',
    });

    return this.detail(user, created.id);
  }

  async cancel(user: AuthenticatedUser, id: string, dto: CancelAppointmentDto): Promise<object> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { userId: true } },
        doctor: { select: { userId: true } },
        session: true,
      },
    });
    if (!appointment) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }
    const relationship = this.relationshipOf(user, appointment);
    if (relationship === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
    }
    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new AppException(ErrorCodes.INVALID_STATE_TRANSITION, 'This appointment can no longer be cancelled');
    }

    const cancelledBy =
      user.role === Role.DOCTOR ? CancelledBy.DOCTOR : user.role === Role.ADMIN ? CancelledBy.ADMIN : CancelledBy.PATIENT;

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy,
          cancellationReason: dto.reason ?? null,
        },
      });
      if (appointment.session) {
        await tx.consultationSession.update({
          where: { id: appointment.session.id },
          data: { status: SessionStatus.CANCELLED },
        });
      }
    });

    this.events.emit({
      type: 'appointment.cancelled',
      appointmentId: appointment.id,
      patientUserId: appointment.patient.userId,
      doctorUserId: appointment.doctor.userId,
      byRole: cancelledBy,
    });

    return this.detail(user, appointment.id);
  }

  private async createAppointment(input: {
    patientProfileId: string;
    doctorProfileId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
    symptomIds: string[];
    patientUserId: string;
    doctorUserId: string;
  }): Promise<{ id: string }> {
    const appointment = await this.prisma.$transaction(
      async (tx) => {
        const patientConflict = await tx.appointment.findFirst({
          where: {
            patientProfileId: input.patientProfileId,
            status: { in: ACTIVE_STATUSES },
            startsAt: { lt: input.endsAt },
            endsAt: { gt: input.startsAt },
          },
          select: { id: true },
        });
        if (patientConflict) {
          throw new AppException(ErrorCodes.PATIENT_DOUBLE_BOOKED, 'You already have an appointment at this time');
        }
        const doctorConflict = await tx.appointment.findFirst({
          where: {
            doctorProfileId: input.doctorProfileId,
            status: { in: ACTIVE_STATUSES },
            startsAt: { lt: input.endsAt },
            endsAt: { gt: input.startsAt },
          },
          select: { id: true },
        });
        if (doctorConflict) {
          throw new AppException(ErrorCodes.SLOT_UNAVAILABLE, 'That time is no longer available');
        }

        const created = await tx.appointment.create({
          data: {
            patientProfileId: input.patientProfileId,
            doctorProfileId: input.doctorProfileId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            status: AppointmentStatus.CONFIRMED,
            reason: input.reason,
            symptomIds: input.symptomIds,
          },
        });
        await tx.consultationSession.create({
          data: { appointmentId: created.id, status: SessionStatus.SCHEDULED },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error: unknown) => {
      if (error instanceof AppException) throw error;
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppException(ErrorCodes.SLOT_UNAVAILABLE, 'That time is no longer available');
      }
      throw error;
    });

    this.events.emit({
      type: 'appointment.booked',
      appointmentId: appointment.id,
      patientUserId: input.patientUserId,
      doctorUserId: input.doctorUserId,
      startsAt: input.startsAt,
    });

    return appointment;
  }

  private async scopeWhere(user: AuthenticatedUser): Promise<Prisma.AppointmentWhereInput> {
    if (user.role === Role.PATIENT) {
      const profile = await this.patientProfileFor(user.id);
      return { patientProfileId: profile.id };
    }
    if (user.role === Role.DOCTOR) {
      const profile = await this.doctorProfileFor(user.id);
      return { doctorProfileId: profile.id };
    }
    throw new AppException(ErrorCodes.FORBIDDEN, 'Administrators manage appointments via /admin');
  }

  private relationshipOf(
    user: AuthenticatedUser,
    appointment: { patientProfileId: string; doctorProfileId: string; patient?: { userId: string } | null; doctor?: { userId: string } | null },
  ): 'patient' | 'doctor' | 'admin' | 'none' {
    if (user.role === Role.ADMIN) return 'admin';
    if (user.role === Role.PATIENT && appointment.patient?.userId === user.id) return 'patient';
    if (user.role === Role.DOCTOR && appointment.doctor?.userId === user.id) return 'doctor';
    // Fall back to profile ids when userIds are not included.
    return 'none';
  }

  private async patientProfileFor(userId: string): Promise<{ id: string; userId: string }> {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId }, select: { id: true, userId: true } });
    if (!profile) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'No patient profile is associated with this account');
    }
    return profile;
  }

  private async doctorProfileFor(userId: string): Promise<{ id: string; userId: string }> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, userId: true } });
    if (!profile) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'No doctor profile is associated with this account');
    }
    return profile;
  }

  private toCard(row: AppointmentRow): object {
    const patientName = nameOf(row.patient.firstName, row.patient.lastName);
    const doctorName = nameOf(row.doctor.firstName, row.doctor.lastName, row.doctor.title);
    const primary = row.doctor.specializations[0]?.specialization.name ?? null;
    return {
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
      reason: row.reason,
      patient: {
        id: row.patient.id,
        displayName: patientName,
        initials: initialsOf(patientName),
        avatarColor: row.patient.avatarColor,
      },
      doctor: {
        id: row.doctor.id,
        displayName: doctorName,
        initials: initialsOf(doctorName),
        avatarColor: row.doctor.avatarColor,
        primarySpecialization: primary,
      },
      session: row.session
        ? {
            id: row.session.id,
            status: row.session.status,
            joinableAt: new Date(row.startsAt.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000).toISOString(),
          }
        : null,
      hasNote: row.note != null,
      prescriptionCount: row.prescriptions.length,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDetail(appointment: object & { [key: string]: unknown }, canSeeRecords: boolean): object {
    const row = appointment as {
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: AppointmentStatus;
      reason: string;
      symptomIds: string[];
      rescheduledFromId: string | null;
      cancelledBy: CancelledBy | null;
      cancellationReason: string | null;
      createdAt: Date;
      patient: { id: string; firstName: string; lastName: string; avatarColor: string };
      doctor: {
        id: string;
        firstName: string;
        lastName: string;
        title: string | null;
        avatarColor: string;
        specializations: { specialization: { name: string } }[];
      };
      session: {
        id: string;
        status: SessionStatus;
        patientJoinedAt: Date | null;
        doctorJoinedAt: Date | null;
        startedAt: Date | null;
        endedAt: Date | null;
      } | null;
      note: object | null;
      prescriptions: object[];
    };
    const patientName = nameOf(row.patient.firstName, row.patient.lastName);
    const doctorName = nameOf(row.doctor.firstName, row.doctor.lastName, row.doctor.title);
    return {
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
      reason: row.reason,
      symptomIds: row.symptomIds,
      rescheduledFromId: row.rescheduledFromId,
      cancelledBy: row.cancelledBy,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt.toISOString(),
      patient: { id: row.patient.id, displayName: patientName, initials: initialsOf(patientName), avatarColor: row.patient.avatarColor },
      doctor: {
        id: row.doctor.id,
        displayName: doctorName,
        initials: initialsOf(doctorName),
        avatarColor: row.doctor.avatarColor,
        primarySpecialization: row.doctor.specializations[0]?.specialization.name ?? null,
      },
      session: row.session
        ? {
            id: row.session.id,
            status: row.session.status,
            joinableAt: new Date(row.startsAt.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000).toISOString(),
            patientJoinedAt: row.session.patientJoinedAt?.toISOString() ?? null,
            doctorJoinedAt: row.session.doctorJoinedAt?.toISOString() ?? null,
            startedAt: row.session.startedAt?.toISOString() ?? null,
            endedAt: row.session.endedAt?.toISOString() ?? null,
          }
        : null,
      note: canSeeRecords ? row.note : undefined,
      prescriptions: canSeeRecords ? row.prescriptions : undefined,
    };
  }
}
