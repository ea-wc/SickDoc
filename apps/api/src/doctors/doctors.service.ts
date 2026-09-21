import { Injectable } from '@nestjs/common';
import { DoctorStatus, Prisma, UserStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import { AppException } from '../common/exceptions/app.exception.js';
import { pageMeta, skipOf } from '../common/dto/pagination-query.dto.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DoctorSearchQueryDto } from './dto/doctor-query.dto.js';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto.js';

const cardSelect = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  bio: true,
  yearsOfExperience: true,
  languages: true,
  timezone: true,
  consultationFee: true,
  avatarColor: true,
  specializations: { include: { specialization: true } },
} satisfies Prisma.DoctorProfileSelect;

type DoctorCardRow = Prisma.DoctorProfileGetPayload<{ select: typeof cardSelect }>;

/** Public card shape from API_SPEC §5. */
export interface PublicDoctorCard {
  id: string;
  displayName: string;
  title: string | null;
  initials: string;
  avatarColor: string;
  bio: string | null;
  yearsOfExperience: number;
  languages: string[];
  timezone: string;
  consultationFee: string | null;
  specializations: { id: string; name: string; isPrimary: boolean }[];
  nextAvailableAt: string | null;
}

interface RankedCard {
  card: PublicDoctorCard;
  yearsOfExperience: number;
  nextAvailableAtMs: number | null;
  displayName: string;
}

function displayNameOf(row: { title: string | null; firstName: string; lastName: string }): string {
  return [row.title, row.firstName, row.lastName].filter(Boolean).join(' ');
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

/** Patient-facing doctor directory (docs/API_SPEC.md §5). */
@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /** Doctor self-service profile (docs/API_SPEC.md §10). */
  async getMe(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { specializations: { include: { specialization: true } } },
    });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Doctor profile not found');
    }
    return profile;
  }

  async updateMe(userId: string, dto: UpdateDoctorProfileDto) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { specializations: { include: { specialization: true } } },
    });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Doctor profile not found');
    }

    const data: Prisma.DoctorProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.title !== undefined) data.title = dto.title || null;
    if (dto.bio !== undefined) data.bio = dto.bio || null;
    if (dto.yearsOfExperience !== undefined) data.yearsOfExperience = dto.yearsOfExperience;
    if (dto.consultationFee !== undefined) data.consultationFee = dto.consultationFee;
    if (dto.languages !== undefined) data.languages = dto.languages;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;

    const changed =
      Object.keys(data).length > 0 || dto.specializationIds !== undefined || dto.primarySpecializationId !== undefined;
    if (changed && profile.status === DoctorStatus.REJECTED) {
      data.status = DoctorStatus.PENDING;
      data.reviewedBy = { disconnect: true };
      data.reviewedAt = null;
      data.reviewNote = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorProfile.update({ where: { id: profile.id }, data });

      if (dto.specializationIds !== undefined || dto.primarySpecializationId !== undefined) {
        const ids = dto.specializationIds ?? profile.specializations.map((s) => s.specializationId);
        const primary =
          dto.primarySpecializationId ?? profile.specializations.find((s) => s.isPrimary)?.specializationId ?? ids[0];
        if (!ids.includes(primary)) {
          throw new AppException(ErrorCodes.VALIDATION_FAILED, 'Primary specialization must be one of the selected specializations', [
            { field: 'primarySpecializationId', issue: 'must be included in specializationIds' },
          ]);
        }
        const existing = await tx.specialization.findMany({ where: { id: { in: ids } }, select: { id: true } });
        if (existing.length !== new Set(ids).size) {
          throw new AppException(ErrorCodes.VALIDATION_FAILED, 'One or more specializations are invalid');
        }
        await tx.doctorSpecialization.deleteMany({ where: { doctorProfileId: profile.id } });
        await tx.doctorSpecialization.createMany({
          data: ids.map((id) => ({ doctorProfileId: profile.id, specializationId: id, isPrimary: id === primary })),
        });
      }
    });

    return this.getMe(userId);
  }

  async listSpecializations(): Promise<{ data: { id: string; slug: string; name: string; doctorCount: number }[] }> {
    const specializations = await this.prisma.specialization.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { doctorLinks: { where: { doctor: { status: DoctorStatus.APPROVED } } } } },
      },
    });
    return {
      data: specializations.map((s) => ({ id: s.id, slug: s.slug, name: s.name, doctorCount: s._count.doctorLinks })),
    };
  }

  async search(query: DoctorSearchQueryDto): Promise<{ data: PublicDoctorCard[]; meta: ReturnType<typeof pageMeta> }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.DoctorProfileWhereInput = {
      status: DoctorStatus.APPROVED,
      user: { status: UserStatus.ACTIVE },
    };
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { bio: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.specializationId) {
      where.specializations = { some: { specializationId: query.specializationId } };
    }
    if (query.language) {
      where.languages = { has: query.language };
    }
    if (query.minExperience != null) {
      where.yearsOfExperience = { gte: query.minExperience };
    }

    const rows = await this.prisma.doctorProfile.findMany({ where, select: cardSelect });
    const ranked: RankedCard[] = [];
    for (const row of rows) {
      const nextAvailableAt = await this.availability.nextAvailableAt(row.id);
      if (query.availableFrom) {
        const from = new Date(`${query.availableFrom}T00:00:00.000Z`).getTime();
        if (!nextAvailableAt || nextAvailableAt.getTime() < from) continue;
      }
      if (query.availableTo) {
        const to = new Date(`${query.availableTo}T00:00:00.000Z`).getTime() + 24 * 3600_000;
        if (!nextAvailableAt || nextAvailableAt.getTime() > to) continue;
      }
      const card = this.toCard(row, nextAvailableAt);
      ranked.push({
        card,
        yearsOfExperience: row.yearsOfExperience,
        nextAvailableAtMs: nextAvailableAt?.getTime() ?? null,
        displayName: card.displayName,
      });
    }

    this.sortRanked(ranked, query.sort);
    const total = ranked.length;
    return {
      data: ranked.slice(skipOf(page, pageSize), skipOf(page, pageSize) + pageSize).map((r) => r.card),
      meta: pageMeta(total, page, pageSize),
    };
  }

  async getDoctor(id: string): Promise<PublicDoctorCard> {
    const row = await this.prisma.doctorProfile.findFirst({
      where: { id, status: DoctorStatus.APPROVED, user: { status: UserStatus.ACTIVE } },
      select: cardSelect,
    });
    if (!row) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Doctor not found');
    }
    const nextAvailableAt = await this.availability.nextAvailableAt(row.id);
    return this.toCard(row, nextAvailableAt);
  }

  async getSlots(id: string, from: string, to: string): Promise<{ data: object[]; meta: object }> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (toDate.getTime() < fromDate.getTime() || toDate.getTime() > fromDate.getTime() + 31 * 24 * 3600_000) {
      throw new AppException(ErrorCodes.INVALID_DATE_RANGE, 'Date range must be at most 31 days and end after it starts');
    }

    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id, status: DoctorStatus.APPROVED, user: { status: UserStatus.ACTIVE } },
      select: { id: true, timezone: true },
    });
    if (!doctor) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Doctor not found');
    }

    const { days, timezone, slotMinutes, leadTimeMinutes } = await this.availability.derive(doctor.id, from, to);
    return {
      data: days.map((day) => ({
        date: day.date,
        slots: day.slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          available: slot.available,
        })),
      })),
      meta: { timezone, slotMinutes, leadTimeMinutes },
    };
  }

  private toCard(row: DoctorCardRow, nextAvailableAt: Date | null): PublicDoctorCard {
    const displayName = displayNameOf(row);
    return {
      id: row.id,
      displayName,
      title: row.title,
      initials: initialsOf(displayName),
      avatarColor: row.avatarColor,
      bio: row.bio,
      yearsOfExperience: row.yearsOfExperience,
      languages: row.languages,
      timezone: row.timezone,
      consultationFee: row.consultationFee?.toString() ?? null,
      specializations: row.specializations.map((link) => ({
        id: link.specialization.id,
        name: link.specialization.name,
        isPrimary: link.isPrimary,
      })),
      nextAvailableAt: nextAvailableAt?.toISOString() ?? null,
    };
  }

  private sortRanked(ranked: RankedCard[], sort?: string): void {
    ranked.sort((a, b) => {
      if (sort === 'experience') {
        return (
          b.yearsOfExperience - a.yearsOfExperience ||
          (a.nextAvailableAtMs ?? Infinity) - (b.nextAvailableAtMs ?? Infinity)
        );
      }
      return (
        (a.nextAvailableAtMs ?? Infinity) - (b.nextAvailableAtMs ?? Infinity) ||
        a.displayName.localeCompare(b.displayName)
      );
    });
  }
}
