import { Injectable } from '@nestjs/common';
import { DoctorStatus, Prisma, UserStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import { AppException } from '../common/exceptions/app.exception.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SuggestDto } from './dto/suggest.dto.js';
import { matchFreeText, scoreDoctor, SymptomForMatching } from './scoring.js';

const doctorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  bio: true,
  yearsOfExperience: true,
  timezone: true,
  avatarColor: true,
  specializations: { include: { specialization: true } },
} satisfies Prisma.DoctorProfileSelect;

type DoctorRow = Prisma.DoctorProfileGetPayload<{ select: typeof doctorSelect }>;

function displayNameOf(row: DoctorRow): string {
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

/** Guided symptom → specialization → doctor ranking (docs/API_SPEC.md §6). */
@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async listSymptoms(q?: string): Promise<{ data: { id: string; slug: string; label: string; bodySystem: string | null }[] }> {
    const symptoms = await this.prisma.symptom.findMany({
      where: q
        ? { OR: [{ label: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { label: 'asc' },
      select: { id: true, slug: true, label: true, bodySystem: true },
    });
    return { data: symptoms };
  }

  async suggest(dto: SuggestDto): Promise<object> {
    const selectedIds = dto.symptomIds ?? [];
    const freeText = dto.freeText?.trim() ?? '';
    if (selectedIds.length === 0 && !freeText) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'Provide at least one symptom or some free text');
    }

    // Resolve selected symptoms and free-text matches.
    const allSymptoms = await this.prisma.symptom.findMany({ select: { id: true, slug: true, label: true, synonyms: true } });
    const selectedRows = allSymptoms.filter((s) => selectedIds.includes(s.id));
    const freeTextIds = matchFreeText(freeText, allSymptoms as SymptomForMatching[]);
    const freeTextRows = allSymptoms.filter((s) => freeTextIds.includes(s.id) && !selectedIds.includes(s.id));

    const matchedSymptoms = [
      ...selectedRows.map((s) => ({ id: s.id, label: s.label, source: 'selected' as const })),
      ...freeTextRows.map((s) => ({ id: s.id, label: s.label, source: 'freeText' as const })),
    ];
    if (matchedSymptoms.length === 0) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'No symptoms could be matched from the input');
    }

    const matchedIds = matchedSymptoms.map((s) => s.id);

    // Aggregate per-specialization weights from SymptomSpecialty.
    const links = await this.prisma.symptomSpecialty.findMany({
      where: { symptomId: { in: matchedIds } },
      include: { specialization: { select: { id: true, name: true } } },
    });
    const weightBySpecialty = new Map<string, { name: string; weight: number }>();
    for (const link of links) {
      const current = weightBySpecialty.get(link.specializationId) ?? { name: link.specialization.name, weight: 0 };
      current.weight += link.weight;
      weightBySpecialty.set(link.specializationId, current);
    }

    const doctors = await this.prisma.doctorProfile.findMany({
      where: { status: DoctorStatus.APPROVED, user: { status: UserStatus.ACTIVE } },
      select: doctorSelect,
    });

    const now = new Date();
    const scored: { row: DoctorRow; nextAvailableAt: Date | null; output: ReturnType<typeof scoreDoctor> }[] = [];
    for (const row of doctors) {
      const nextAvailableAt = await this.availability.nextAvailableAt(row.id);
      scored.push({
        row,
        nextAvailableAt,
        output: scoreDoctor({
          yearsOfExperience: row.yearsOfExperience,
          nextAvailableAt,
          specializations: row.specializations.map((link) => ({
            name: link.specialization.name,
            weight: weightBySpecialty.get(link.specialization.id)?.weight ?? 0,
          })),
          now,
        }),
      });
    }

    scored.sort((a, b) => {
      if (b.output.score !== a.output.score) return b.output.score - a.output.score;
      const aNext = a.nextAvailableAt?.getTime() ?? Infinity;
      const bNext = b.nextAvailableAt?.getTime() ?? Infinity;
      if (aNext !== bNext) return aNext - bNext;
      return a.row.id.localeCompare(b.row.id);
    });

    const limit = dto.limit ?? 5;
    const suggestions = scored.slice(0, limit).map(({ row, nextAvailableAt, output }) => ({
      doctor: this.toDoctorCard(row, nextAvailableAt?.getTime() ?? null),
      score: output.score,
      nextAvailableAt: nextAvailableAt?.toISOString() ?? null,
      rationale: {
        specializations: output.specializations,
        availabilityBonus: output.availabilityBonus,
        experienceBonus: output.experienceBonus,
      },
    }));

    return { matchedSymptoms, suggestions };
  }

  private toDoctorCard(row: DoctorRow, nextAvailableAtMs: number | null): object {
    const displayName = displayNameOf(row);
    return {
      id: row.id,
      displayName,
      title: row.title,
      initials: initialsOf(displayName),
      avatarColor: row.avatarColor,
      bio: row.bio,
      yearsOfExperience: row.yearsOfExperience,
      timezone: row.timezone,
      specializations: row.specializations.map((link) => ({
        id: link.specialization.id,
        name: link.specialization.name,
        isPrimary: link.isPrimary,
      })),
      nextAvailableAt: nextAvailableAtMs != null ? new Date(nextAvailableAtMs).toISOString() : null,
    };
  }
}
