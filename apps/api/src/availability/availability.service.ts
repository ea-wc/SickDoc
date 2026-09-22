import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import { AppException } from '../common/exceptions/app.exception.js';
import { DomainEventsService } from '../common/events/domain-events.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAvailabilityExceptionDto, ReplaceAvailabilityRulesDto } from './dto/availability.dto.js';
import { deriveSlots, findSlot, SlotInstant, SlotRuleInput } from './slots.js';
import { addDays, dateOnlyString, utcToLocalDateString, weekdayOf, utcToLocalMinuteOfDay } from './timezone.js';

const DEFAULT_SLOT_MINUTES = 30;
const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
];

export interface DerivedAvailability {
  days: ReturnType<typeof deriveSlots>;
  timezone: string;
  slotMinutes: number;
}

/** True when the given rules generate a slot that exactly covers [startsAt, endsAt]. */
export function isCoveredByRules(rules: SlotRuleInput[], startsAt: Date, endsAt: Date, timeZone: string): boolean {
  const localDate = utcToLocalDateString(timeZone, startsAt);
  const weekday = weekdayOf(localDate);
  const startLocal = utcToLocalMinuteOfDay(timeZone, startsAt);
  const endLocal = utcToLocalMinuteOfDay(timeZone, endsAt);
  for (const rule of rules) {
    if (rule.weekday !== weekday) continue;
    if (rule.effectiveFrom && localDate < rule.effectiveFrom) continue;
    if (rule.effectiveTo && localDate > rule.effectiveTo) continue;
    const slot = Math.max(1, rule.slotMinutes || DEFAULT_SLOT_MINUTES);
    const startOk =
      startLocal >= rule.startMinute && startLocal < rule.endMinute && (startLocal - rule.startMinute) % slot === 0;
    const endOk = endLocal === startLocal + slot && endLocal <= rule.endMinute;
    if (startOk && endOk) return true;
  }
  return false;
}

/** Availability rules, exceptions, and derived-slot access (docs/API_SPEC.md §5, §10). */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  /** Resolves the caller's doctor profile (availability is managed by the doctor). */
  async resolveDoctorProfile(userId: string): Promise<{ id: string; timezone: string }> {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true, timezone: true },
    });
    if (!profile) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'No doctor profile is associated with this account');
    }
    return profile;
  }

  async getAvailability(doctorProfileId: string): Promise<{ rules: object[]; exceptions: object[]; timezone: string }> {
    const [rules, exceptions, profile] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { doctorProfileId }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] }),
      this.prisma.availabilityException.findMany({ where: { doctorProfileId }, orderBy: { startsAt: 'asc' } }),
      this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId }, select: { timezone: true } }),
    ]);
    return { rules, exceptions, timezone: profile?.timezone ?? 'UTC' };
  }

  async replaceRules(
    doctorProfileId: string,
    dto: ReplaceAvailabilityRulesDto,
  ): Promise<{ rules: object[]; conflicts: ConflictAppointment[]; timezone: string }> {
    const timezone = (await this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId }, select: { timezone: true } }))?.timezone ?? 'UTC';
    const incoming = dto.rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      slotMinutes: rule.slotMinutes ?? DEFAULT_SLOT_MINUTES,
      isActive: rule.isActive ?? true,
    }));

    // Reject overlapping rules for the same weekday.
    for (const rule of incoming) {
      if (rule.endMinute <= rule.startMinute) {
        throw new AppException(ErrorCodes.VALIDATION_FAILED, 'A rule must end after it starts', [
          { field: 'rules', issue: 'endMinute must be greater than startMinute' },
        ]);
      }
    }
    const byWeekday = new Map<number, typeof incoming>();
    for (const rule of incoming) {
      const list = byWeekday.get(rule.weekday) ?? [];
      const overlapsExisting = list.some(
        (r) => rule.startMinute < r.endMinute && r.startMinute < rule.endMinute,
      );
      if (overlapsExisting) {
        throw new AppException(ErrorCodes.VALIDATION_FAILED, 'Availability rules must not overlap on the same weekday', [
          { field: 'rules', issue: `overlapping rules on weekday ${rule.weekday}` },
        ]);
      }
      list.push(rule);
      byWeekday.set(rule.weekday, list);
    }

    // Replace atomically, then surface appointments that fall outside the new rules.
    await this.prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { doctorProfileId } });
      await tx.availabilityRule.createMany({
        data: incoming.map((rule) => ({ doctorProfileId, ...rule })),
      });
    });

    const conflicts = await this.findConflictingAppointments(doctorProfileId, timezone, incoming);
    if (conflicts.length > 0) {
      const patientUserIds = conflicts.map((a) => a.patient.userId);
      this.events.emit({ type: 'schedule.changed', patientUserIds });
    }

    const rules = await this.prisma.availabilityRule.findMany({ where: { doctorProfileId }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
    return { rules, conflicts, timezone };
  }

  async addException(doctorProfileId: string, dto: CreateAvailabilityExceptionDto): Promise<object> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(endsAt.getTime() > startsAt.getTime())) {
      throw new AppException(ErrorCodes.INVALID_DATE_RANGE, 'An exception must end after it starts');
    }

    const blocking = await this.prisma.appointment.findMany({
      where: {
        doctorProfileId,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (blocking.length > 0) {
      throw new AppException(
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        'This exception covers active appointments; cancel or reschedule them first',
        blocking.map((a) => ({ field: 'appointmentId', issue: a.id })),
      );
    }

    return this.prisma.availabilityException.create({
      data: { doctorProfileId, startsAt, endsAt, reason: dto.reason ?? null },
    });
  }

  async deleteException(doctorProfileId: string, exceptionId: string): Promise<void> {
    const result = await this.prisma.availabilityException.deleteMany({ where: { id: exceptionId, doctorProfileId } });
    if (result.count === 0) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Availability exception not found');
    }
  }

  /** Derives bookable slots for a doctor across a date window (in the doctor's timezone). */
  async derive(doctorProfileId: string, from: string, to: string): Promise<DerivedAvailability> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId }, select: { timezone: true } });
    const timezone = profile?.timezone ?? 'UTC';
    const [rules, exceptions, appointments] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { doctorProfileId, isActive: true } }),
      this.prisma.availabilityException.findMany({ where: { doctorProfileId } }),
      this.prisma.appointment.findMany({
        where: { doctorProfileId, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);
    const days = deriveSlots({
      rules: rules.map((r) => ({
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        slotMinutes: r.slotMinutes,
        effectiveFrom: r.effectiveFrom ? dateOnlyString(r.effectiveFrom) : null,
        effectiveTo: r.effectiveTo ? dateOnlyString(r.effectiveTo) : null,
      })),
      exceptions,
      appointments,
      from,
      to,
      timeZone: timezone,
      now: new Date(),
    });
    return { days, timezone, slotMinutes: DEFAULT_SLOT_MINUTES };
  }

  /** Earliest available slot within `withinDays`, or null. */
  async nextAvailableAt(doctorProfileId: string, withinDays = 14): Promise<Date | null> {
    const from = dateOnlyString(new Date());
    const to = dateOnlyString(addDays(new Date(), withinDays));
    const { days } = await this.derive(doctorProfileId, from, to);
    for (const day of days) {
      for (const slot of day.slots) {
        if (slot.available) return slot.startsAt;
      }
    }
    return null;
  }

  /** Resolves the generated slot covering `startsAt` for booking conflict checks. */
  async slotAt(doctorProfileId: string, startsAt: Date): Promise<{ slot?: SlotInstant; timezone: string }> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId }, select: { timezone: true } });
    const timezone = profile?.timezone ?? 'UTC';
    const localDate = utcToLocalDateString(timezone, startsAt);
    const { days } = await this.derive(doctorProfileId, localDate, localDate);
    return { slot: findSlot(days, startsAt), timezone };
  }

  private async findConflictingAppointments(doctorProfileId: string, timezone: string, rules: SlotRuleInput[]): Promise<ConflictAppointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { doctorProfileId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, startsAt: { gte: new Date() } },
      include: { patient: { select: { userId: true, firstName: true, lastName: true } } },
      orderBy: { startsAt: 'asc' },
    });
    return appointments
      .filter((appointment) => !isCoveredByRules(rules, appointment.startsAt, appointment.endsAt, timezone))
      .map((appointment) => ({
        id: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        patient: {
          userId: appointment.patient.userId,
          displayName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        },
      }));
  }
}

export interface ConflictAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  patient: { userId: string; displayName: string };
}
