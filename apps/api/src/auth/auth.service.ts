import { Injectable } from '@nestjs/common';
import { DoctorStatus, Role, UserStatus } from '@prisma/client';
import type { User } from '@prisma/client';
import {
  DoctorStatus as SharedDoctorStatus,
  ErrorCodes,
  Role as SharedRole,
  UserStatus as SharedUserStatus,
  UserSummary,
} from '@sickdoc/shared';
import argon2 from 'argon2';
import { AppException } from '../common/exceptions/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import { RegisterPatientDto } from './dto/register-patient.dto.js';
import { TokenService } from './token.service.js';

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#0EA5E9',
  '#84CC16',
  '#A855F7',
  '#F43F5E',
];

/** Internal result of every auth flow; the controller strips the refresh bits. */
export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserSummary;
}

/** `GET /me` payload: the user summary plus their role-specific profile. */
export interface MeResponse extends UserSummary {
  patient: unknown;
  doctor: unknown;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** Deterministic avatar colour from a user id — no image storage. */
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Credential and session logic: registration, login, refresh rotation, logout,
 * profile lookup, and password change (docs/API_SPEC.md §3).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async registerPatient(dto: RegisterPatientDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);
    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: Role.PATIENT, status: UserStatus.ACTIVE },
    });
    await this.prisma.patientProfile.create({
      data: {
        userId: user.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00.000Z`) : null,
        phone: dto.phone ?? null,
        avatarColor: avatarColorFor(user.id),
      },
    });

    return this.completeAuthentication(user);
  }

  async registerDoctor(dto: RegisterDoctorDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);
    const passwordHash = await this.hashPassword(dto.password);

    const specializations = await this.prisma.specialization.findMany({
      where: { id: { in: dto.specializationIds } },
      select: { id: true },
    });
    if (specializations.length !== new Set(dto.specializationIds).size) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'One or more specializations are invalid', [
        { field: 'specializationIds', issue: 'contains an unknown specialization id' },
      ]);
    }
    if (!dto.specializationIds.includes(dto.primarySpecializationId)) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'Primary specialization must be one of the selected specializations', [
        { field: 'primarySpecializationId', issue: 'must be included in specializationIds' },
      ]);
    }

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, passwordHash, role: Role.DOCTOR, status: UserStatus.ACTIVE },
        });
        const profile = await tx.doctorProfile.create({
          data: {
            userId: created.id,
            firstName: dto.firstName,
            lastName: dto.lastName,
            title: dto.title ?? null,
            bio: dto.bio ?? null,
            licenseNumber: dto.licenseNumber,
            yearsOfExperience: dto.yearsOfExperience ?? 0,
            timezone: dto.timezone,
            avatarColor: avatarColorFor(created.id),
            status: DoctorStatus.PENDING,
          },
        });
        await tx.doctorSpecialization.createMany({
          data: dto.specializationIds.map((id) => ({
            doctorProfileId: profile.id,
            specializationId: id,
            isPrimary: id === dto.primarySpecializationId,
          })),
        });
        return created;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, 'License number is already registered', [
          { field: 'licenseNumber', issue: 'already in use' },
        ]);
      }
      throw error;
    }

    return this.completeAuthentication(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppException(ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new AppException(ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
    }
    this.assertActive(user);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.completeAuthentication(user);
  }

  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Refresh token is missing');
    }
    const { userId, next } = await this.tokenService.rotate(rawToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Refresh token is invalid');
    }
    this.assertActive(user);

    const { accessToken, expiresIn } = await this.tokenService.issueAccessToken(user);
    const summary = await this.buildUserSummary(user);
    return { accessToken, expiresIn, refreshToken: next.token, refreshExpiresAt: next.expiresAt, user: summary };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) {
      await this.tokenService.revoke(rawToken);
    }
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'User not found');
    }
    const summary = await this.buildUserSummary(user);

    let patient: unknown = null;
    let doctor: unknown = null;
    if (user.role === Role.PATIENT) {
      patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
    }
    if (user.role === Role.DOCTOR) {
      doctor = await this.prisma.doctorProfile.findUnique({
        where: { userId },
        include: { specializations: { include: { specialization: true } } },
      });
    }

    return { ...summary, patient, doctor };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'User not found');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, 'Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Revokes every other session: all outstanding refresh tokens are invalidated.
    await this.tokenService.revokeAllForUser(userId);
  }

  private async completeAuthentication(user: User): Promise<AuthResult> {
    const { accessToken, expiresIn } = await this.tokenService.issueAccessToken(user);
    const refresh = await this.tokenService.issueRefreshToken(user.id);
    const summary = await this.buildUserSummary(user);
    return {
      accessToken,
      expiresIn,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: summary,
    };
  }

  private assertActive(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppException(ErrorCodes.ACCOUNT_SUSPENDED, 'Account is suspended', [
        { field: 'statusReason', issue: user.statusReason ?? 'No reason provided' },
      ]);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'Account is not active');
    }
  }

  private async buildUserSummary(user: User): Promise<UserSummary> {
    if (user.role === Role.PATIENT) {
      const profile = await this.prisma.patientProfile.findUnique({ where: { userId: user.id } });
      const displayName = profile ? `${profile.firstName} ${profile.lastName}` : user.email;
      return {
        id: user.id,
        email: user.email,
        role: user.role as unknown as SharedRole,
        status: user.status as unknown as SharedUserStatus,
        displayName,
        initials: initialsOf(displayName),
        avatarColor: profile?.avatarColor ?? avatarColorFor(user.id),
        doctorStatus: null,
      };
    }

    if (user.role === Role.DOCTOR) {
      const profile = await this.prisma.doctorProfile.findUnique({ where: { userId: user.id } });
      const displayName = profile ? `${profile.firstName} ${profile.lastName}` : user.email;
      return {
        id: user.id,
        email: user.email,
        role: user.role as unknown as SharedRole,
        status: user.status as unknown as SharedUserStatus,
        displayName,
        initials: initialsOf(displayName),
        avatarColor: profile?.avatarColor ?? avatarColorFor(user.id),
        doctorStatus: profile ? (profile.status as unknown as SharedDoctorStatus) : null,
      };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as unknown as SharedRole,
      status: user.status as unknown as SharedUserStatus,
      displayName: 'Administrator',
      initials: 'AD',
      avatarColor: avatarColorFor(user.id),
      doctorStatus: null,
    };
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new AppException(ErrorCodes.EMAIL_TAKEN, 'An account with this email already exists');
    }
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
