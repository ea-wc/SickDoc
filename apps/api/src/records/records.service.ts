import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Role, SessionStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { DomainEventsService } from '../common/events/domain-events.service.js';
import { pageMeta, skipOf } from '../common/dto/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNoteDto, CreatePrescriptionDto, RecordsQueryDto, UpdateNoteDto } from './dto/record.dto.js';

/** Clinical records: notes, prescriptions, and record timelines (docs/API_SPEC.md §9). */
@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  async createNote(user: AuthenticatedUser, appointmentId: string, dto: CreateNoteDto): Promise<object> {
    const appointment = await this.loadForRecords(appointmentId);
    this.assertAttendingDoctor(user, appointment);

    if (appointment.session.status !== SessionStatus.IN_PROGRESS && appointment.session.status !== SessionStatus.COMPLETED) {
      throw new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, 'Notes can only be written once the consultation is in progress or completed');
    }
    if (appointment.note) {
      throw new AppException(ErrorCodes.NOTE_ALREADY_EXISTS, 'A note already exists for this appointment');
    }

    const note = await this.prisma.consultationNote.create({
      data: {
        appointmentId,
        authorUserId: user.id,
        subjective: dto.subjective ?? null,
        objective: dto.objective ?? null,
        assessment: dto.assessment,
        plan: dto.plan,
        summary: dto.summary,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
      },
    });

    this.events.emit({ type: 'note.available', appointmentId, patientUserId: appointment.patient.userId });
    return note;
  }

  async updateNote(user: AuthenticatedUser, appointmentId: string, dto: UpdateNoteDto): Promise<object> {
    const appointment = await this.loadForRecords(appointmentId);
    this.assertAttendingDoctor(user, appointment);
    if (!appointment.note) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'No note exists for this appointment');
    }

    return this.prisma.consultationNote.update({
      where: { id: appointment.note.id },
      data: {
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        plan: dto.plan,
        summary: dto.summary,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
      },
    });
  }

  async getNote(user: AuthenticatedUser, appointmentId: string): Promise<object> {
    const appointment = await this.loadForRecords(appointmentId);
    const relationship = this.relationshipOf(user, appointment);
    if (relationship === 'none') {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Note not found');
    }
    if (relationship === 'patient' && appointment.session.status !== SessionStatus.COMPLETED) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'Notes become available once the consultation is completed');
    }
    if (!appointment.note) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Note not found');
    }
    return appointment.note;
  }

  async createPrescription(user: AuthenticatedUser, appointmentId: string, dto: CreatePrescriptionDto): Promise<object> {
    const appointment = await this.loadForRecords(appointmentId);
    this.assertAttendingDoctor(user, appointment);

    if (appointment.session.status !== SessionStatus.IN_PROGRESS && appointment.session.status !== SessionStatus.COMPLETED) {
      throw new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, 'Prescriptions can only be issued once the consultation is in progress or completed');
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        appointmentId,
        issuedByUserId: user.id,
        patientProfileId: appointment.patientProfileId,
        issuedAt: new Date(),
        notes: dto.notes ?? null,
        validUntil: dto.validUntil ? new Date(`${dto.validUntil}T00:00:00.000Z`) : null,
        items: {
          create: dto.items.map((item) => ({
            drugName: item.drugName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays ?? null,
            instructions: item.instructions ?? null,
          })),
        },
      },
      include: { items: true },
    });

    this.events.emit({ type: 'prescription.issued', appointmentId, patientUserId: appointment.patient.userId });
    return prescription;
  }

  async recordsForPatient(user: AuthenticatedUser, query: RecordsQueryDto): Promise<{ data: object[]; meta: object }> {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!profile) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'No patient profile is associated with this account');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      patientProfileId: profile.id,
      status: AppointmentStatus.COMPLETED,
      ...(query.from ? { startsAt: { gte: new Date(query.from) } } : {}),
      ...(query.to ? { startsAt: { lte: new Date(query.to) } } : {}),
    };

    const rows = await this.prisma.appointment.findMany({
      where,
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, title: true, avatarColor: true } },
        note: true,
        prescriptions: { include: { items: true }, orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { startsAt: 'desc' },
    });

    const filtered = rows.filter((row) => {
      if (query.type === 'notes') return row.note != null;
      if (query.type === 'prescriptions') return row.prescriptions.length > 0;
      return true;
    });

    const total = filtered.length;
    const data = filtered
      .slice(skipOf(page, pageSize), skipOf(page, pageSize) + pageSize)
      .map((row) => this.toRecordItem(row));

    return { data, meta: pageMeta(total, page, pageSize) };
  }

  async recordsForPatientByDoctor(user: AuthenticatedUser, patientId: string): Promise<object> {
    const doctorProfile = await this.prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!doctorProfile) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'No doctor profile is associated with this account');
    }

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarColor: true,
        birthDate: true,
        sex: true,
        medicalHistory: true,
        allergies: true,
        conditions: true,
      },
    });
    if (!patient) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Patient not found');
    }

    const relationshipCount = await this.prisma.appointment.count({
      where: { doctorProfileId: doctorProfile.id, patientProfileId: patientId },
    });
    if (relationshipCount === 0) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'You have no clinical relationship with this patient');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: { doctorProfileId: doctorProfile.id, patientProfileId: patientId },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, title: true, avatarColor: true } },
        note: true,
        prescriptions: { include: { items: true }, orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { startsAt: 'desc' },
    });

    return {
      patient: {
        id: patient.id,
        displayName: `${patient.firstName} ${patient.lastName}`,
        avatarColor: patient.avatarColor,
        birthDate: patient.birthDate?.toISOString().slice(0, 10) ?? null,
        sex: patient.sex,
        medicalHistory: patient.medicalHistory,
        allergies: patient.allergies,
        conditions: patient.conditions,
      },
      records: appointments.map((appointment) => this.toRecordItem(appointment)),
    };
  }

  private assertAttendingDoctor(user: AuthenticatedUser, appointment: RecordsAppointment): void {
    if (user.role !== Role.DOCTOR || appointment.doctor.userId !== user.id) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'Only the attending doctor can write records for this appointment');
    }
  }

  private relationshipOf(user: AuthenticatedUser, appointment: RecordsAppointment): 'patient' | 'doctor' | 'none' {
    if (user.role === Role.PATIENT && appointment.patient.userId === user.id) return 'patient';
    if (user.role === Role.DOCTOR && appointment.doctor.userId === user.id) return 'doctor';
    return 'none';
  }

  private loadForRecords(appointmentId: string): Promise<RecordsAppointment> {
    return this.prisma.appointment
      .findUnique({
        where: { id: appointmentId },
        include: {
          patient: { select: { userId: true } },
          doctor: { select: { userId: true } },
          session: { select: { status: true } },
          note: true,
        },
      })
      .then((appointment) => {
        if (!appointment) {
          throw new AppException(ErrorCodes.NOT_FOUND, 'Appointment not found');
        }
        if (!appointment.session) {
          throw new AppException(ErrorCodes.INTERNAL_ERROR, 'Consultation session is missing');
        }
        return appointment as unknown as RecordsAppointment;
      });
  }

  private toRecordItem(row: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
    status: AppointmentStatus;
    doctor: { id: string; firstName: string; lastName: string; title: string | null; avatarColor: string };
    note: { id: string; summary: string; createdAt: Date } | null;
    prescriptions: { id: string; issuedAt: Date; notes: string | null; items: object[] }[];
  }): object {
    return {
      appointmentId: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reason: row.reason,
      doctor: {
        id: row.doctor.id,
        displayName: [row.doctor.title, row.doctor.firstName, row.doctor.lastName].filter(Boolean).join(' '),
        avatarColor: row.doctor.avatarColor,
      },
      note: row.note,
      prescriptions: row.prescriptions,
    };
  }
}

interface RecordsAppointment {
  id: string;
  patientProfileId: string;
  doctorProfileId: string;
  patient: { userId: string };
  doctor: { userId: string };
  session: { status: SessionStatus };
  note: { id: string } | null;
}
