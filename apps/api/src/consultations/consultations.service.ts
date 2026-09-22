import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Role, SessionStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { DomainEventsService } from '../common/events/domain-events.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { transition } from './state-machine.js';

/** Consultation workspace and session state machine (docs/API_SPEC.md §8). */
@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  async getWorkspace(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadAppointment(appointmentId);
    const participation = this.participationOf(user, appointment);
    if (participation === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Consultation not found');
    }
    return this.toWorkspace(appointment, participation === 'doctor');
  }

  async join(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadAppointment(appointmentId);
    const participation = this.participationOf(user, appointment);
    if (participation === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Consultation not found');
    }

    const now = new Date();

    const result = transition(appointment.session.status, 'join', {
      patientJoined: appointment.session.patientJoinedAt != null,
      now,
      endsAt: appointment.endsAt,
    });
    if (!result.ok) {
      throw this.transitionError(appointment.session.status, result);
    }

    const updated = await this.prisma.consultationSession.update({
      where: { id: appointment.session.id },
      data: {
        status: SessionStatus.JOINED,
        patientJoinedAt: participation === 'patient' ? appointment.session.patientJoinedAt ?? now : appointment.session.patientJoinedAt,
        doctorJoinedAt: participation === 'doctor' ? appointment.session.doctorJoinedAt ?? now : appointment.session.doctorJoinedAt,
      },
    });
    return { session: updated };
  }

  async start(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadAppointment(appointmentId);
    this.assertDoctor(user, appointment);

    const result = transition(appointment.session.status, 'start', {
      patientJoined: appointment.session.patientJoinedAt != null,
      now: new Date(),
      endsAt: appointment.endsAt,
    });
    if (!result.ok) {
      throw this.transitionError(appointment.session.status, result);
    }

    const session = await this.prisma.consultationSession.update({
      where: { id: appointment.session.id },
      data: { status: SessionStatus.IN_PROGRESS, startedAt: appointment.session.startedAt ?? new Date() },
    });
    return { session };
  }

  async complete(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadAppointment(appointmentId);
    this.assertDoctor(user, appointment);

    const result = transition(appointment.session.status, 'complete', {
      patientJoined: appointment.session.patientJoinedAt != null,
      now: new Date(),
      endsAt: appointment.endsAt,
    });
    if (!result.ok) {
      throw this.transitionError(appointment.session.status, result);
    }

    const now = new Date();
    const startedAt = appointment.session.startedAt ?? appointment.startsAt;
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    await this.prisma.$transaction(async (tx) => {
      await tx.consultationSession.update({
        where: { id: appointment.session.id },
        data: { status: SessionStatus.COMPLETED, endedAt: now, durationSeconds },
      });
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED },
      });
    });

    this.events.emit({ type: 'consultation.completed', appointmentId: appointment.id, patientUserId: appointment.patient.userId });

    const session = await this.prisma.consultationSession.findUnique({ where: { id: appointment.session.id } });
    return { session };
  }

  async noShow(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadAppointment(appointmentId);
    this.assertDoctor(user, appointment);

    const result = transition(appointment.session.status, 'no-show', {
      patientJoined: appointment.session.patientJoinedAt != null,
      now: new Date(),
      endsAt: appointment.endsAt,
    });
    if (!result.ok) {
      throw this.transitionError(appointment.session.status, result);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.consultationSession.update({
        where: { id: appointment.session.id },
        data: { status: SessionStatus.NO_SHOW },
      });
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.NO_SHOW },
      });
    });

    const session = await this.prisma.consultationSession.findUnique({ where: { id: appointment.session.id } });
    return { session };
  }

  private transitionError(
    current: SessionStatus,
    result: Extract<ReturnType<typeof transition>, { ok: false }>,
  ): AppException {
    if (result.code === 'BUSINESS_RULE_VIOLATION') {
      return new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, result.message);
    }
    return new AppException(ErrorCodes.INVALID_STATE_TRANSITION, result.message, [
      { field: 'session', issue: `current state is ${current}` },
    ]);
  }

  private assertDoctor(user: AuthenticatedUser, appointment: LoadedAppointment): void {
    if (user.role !== Role.DOCTOR || appointment.doctor.userId !== user.id) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'Only the attending doctor can perform this action');
    }
  }

  private participationOf(user: AuthenticatedUser, appointment: LoadedAppointment): 'patient' | 'doctor' | 'none' {
    if (user.role === Role.PATIENT && appointment.patient.userId === user.id) return 'patient';
    if (user.role === Role.DOCTOR && appointment.doctor.userId === user.id) return 'doctor';
    return 'none';
  }

  private loadAppointment(appointmentId: string): Promise<LoadedAppointment> {
    return this.prisma.appointment
      .findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              avatarColor: true,
              birthDate: true,
              sex: true,
              medicalHistory: true,
              allergies: true,
              conditions: true,
            },
          },
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
          session: true,
        },
      })
      .then((appointment) => {
        if (!appointment) {
          throw new AppException(ErrorCodes.NOT_FOUND, 'Consultation not found');
        }
        if (!appointment.session) {
          throw new AppException(ErrorCodes.INTERNAL_ERROR, 'Consultation session is missing');
        }
        return appointment as unknown as LoadedAppointment;
      });
  }

  private async toWorkspace(appointment: LoadedAppointment, forDoctor: boolean): Promise<object> {
    const patientName = [appointment.patient.firstName, appointment.patient.lastName].join(' ');
    const doctorName = [appointment.doctor.title, appointment.doctor.firstName, appointment.doctor.lastName]
      .filter(Boolean)
      .join(' ');

    let patientHistory: object | undefined;
    if (forDoctor) {
      const past = await this.prisma.appointment.findMany({
        where: {
          doctorProfileId: appointment.doctorProfileId,
          patientProfileId: appointment.patientProfileId,
          status: AppointmentStatus.COMPLETED,
          id: { not: appointment.id },
        },
        include: { note: true },
        orderBy: { startsAt: 'desc' },
        take: 10,
      });
      patientHistory = {
        medicalHistory: appointment.patient.medicalHistory,
        allergies: appointment.patient.allergies,
        conditions: appointment.patient.conditions,
        pastConsultations: past.map((p) => ({
          id: p.id,
          startsAt: p.startsAt.toISOString(),
          reason: p.reason,
          noteSummary: p.note?.summary ?? null,
        })),
      };
    }

    return {
      appointment: {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
        reason: appointment.reason,
      },
      session: {
        id: appointment.session.id,
        status: appointment.session.status,
        patientJoinedAt: appointment.session.patientJoinedAt?.toISOString() ?? null,
        doctorJoinedAt: appointment.session.doctorJoinedAt?.toISOString() ?? null,
        startedAt: appointment.session.startedAt?.toISOString() ?? null,
        endedAt: appointment.session.endedAt?.toISOString() ?? null,
        durationSeconds: appointment.session.durationSeconds ?? null,
      },
      patient: {
        id: appointment.patient.id,
        displayName: patientName,
        initials: this.initialsOf(patientName),
        avatarColor: appointment.patient.avatarColor,
      },
      doctor: {
        id: appointment.doctor.id,
        displayName: doctorName,
        initials: this.initialsOf(doctorName),
        avatarColor: appointment.doctor.avatarColor,
        primarySpecialization: appointment.doctor.specializations[0]?.specialization.name ?? null,
      },
      patientHistory,
    };
  }

  private initialsOf(name: string): string {
    const parts = name
      .replace(/^(Dr\.?|Prof\.?)\s+/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return `${first}${last}`.toUpperCase();
  }
}

interface LoadedAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  reason: string;
  patientProfileId: string;
  doctorProfileId: string;
  patient: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
    birthDate: Date | null;
    sex: string | null;
    medicalHistory: string | null;
    allergies: string[];
    conditions: string[];
  };
  doctor: {
    id: string;
    userId: string;
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
    durationSeconds: number | null;
  };
}
