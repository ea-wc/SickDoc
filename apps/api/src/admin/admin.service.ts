import { Injectable } from "@nestjs/common";
import {
  AppointmentStatus,
  AuditAction,
  CancelledBy,
  DoctorStatus,
  Prisma,
  SessionStatus,
  UserStatus,
} from "@prisma/client";
import { ErrorCodes } from "@sickdoc/shared";
import { AppException } from "../common/exceptions/app.exception.js";
import { DomainEventsService } from "../common/events/domain-events.service.js";
import { pageMeta, skipOf } from "../common/dto/pagination-query.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  AdminAppointmentsQueryDto,
  AdminDoctorsQueryDto,
  AdminUsersQueryDto,
  AuditLogsQueryDto,
  ResolveAppointmentDto,
  ReviewDoctorDto,
  UpdateUserStatusDto,
} from "./dto/admin.dto.js";
import { UpdateDoctorProfileDto } from "../doctors/dto/update-doctor-profile.dto.js";

/** Admin console (docs/API_SPEC.md §12). Every mutation writes an AuditLog in the same transaction. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  async dashboard() {
    const now = new Date();
    const [
      totalUsers,
      patients,
      doctors,
      admins,
      active,
      suspended,
      deactivated,
      pendingDoctors,
      approvedDoctors,
      rejectedDoctors,
      totalAppointments,
      upcoming,
      completed,
      cancelled,
      noShow,
      scheduledSessions,
      inProgressSessions,
      completedSessions,
      recentAuditCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "PATIENT" } }),
      this.prisma.user.count({ where: { role: "DOCTOR" } }),
      this.prisma.user.count({ where: { role: "ADMIN" } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.DEACTIVATED } }),
      this.prisma.doctorProfile.count({ where: { status: DoctorStatus.PENDING } }),
      this.prisma.doctorProfile.count({ where: { status: DoctorStatus.APPROVED } }),
      this.prisma.doctorProfile.count({ where: { status: DoctorStatus.REJECTED } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({ where: { startsAt: { gte: now }, status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED] } } }),
      this.prisma.appointment.count({ where: { status: AppointmentStatus.COMPLETED } }),
      this.prisma.appointment.count({ where: { status: AppointmentStatus.CANCELLED } }),
      this.prisma.appointment.count({ where: { status: AppointmentStatus.NO_SHOW } }),
      this.prisma.consultationSession.count({ where: { status: SessionStatus.SCHEDULED } }),
      this.prisma.consultationSession.count({ where: { status: SessionStatus.IN_PROGRESS } }),
      this.prisma.consultationSession.count({ where: { status: SessionStatus.COMPLETED } }),
      this.prisma.auditLog.count(),
    ]);

    return {
      users: { total: totalUsers, patients, doctors, admins, active, suspended, deactivated },
      doctors: { pending: pendingDoctors, approved: approvedDoctors, rejected: rejectedDoctors },
      appointments: { total: totalAppointments, upcoming, completed, cancelled, noShow },
      sessions: { scheduled: scheduledSessions, inProgress: inProgressSessions, completed: completedSessions },
      recentAuditCount,
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { patientProfile: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
        { doctorProfile: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: skipOf(page, pageSize),
        take: pageSize,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          statusReason: true,
          lastLoginAt: true,
          createdAt: true,
          patientProfile: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
          doctorProfile: { select: { id: true, firstName: true, lastName: true, title: true, avatarColor: true, status: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        statusReason: row.statusReason,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        displayName:
          row.patientProfile
            ? `${row.patientProfile.firstName} ${row.patientProfile.lastName}`
            : row.doctorProfile
              ? [row.doctorProfile.title, row.doctorProfile.firstName, row.doctorProfile.lastName].filter(Boolean).join(" ")
              : "Administrator",
        doctorStatus: row.doctorProfile?.status ?? null,
      })),
      meta: pageMeta(total, page, pageSize),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        patientProfile: true,
        doctorProfile: { include: { specializations: { include: { specialization: true } } } },
        _count: { select: { notifications: true } },
      },
    });
    if (!user) {
      throw new AppException(ErrorCodes.NOT_FOUND, "User not found");
    }

    // Users hold at most one of a patient or doctor profile (admins neither).
    // Build the ownership filter from whichever profile ids actually exist —
    // an empty OR matches nothing, which is correct for administrators.
    const ownershipOr: Prisma.AppointmentWhereInput[] = [];
    if (user.patientProfile) ownershipOr.push({ patientProfileId: user.patientProfile.id });
    if (user.doctorProfile) ownershipOr.push({ doctorProfileId: user.doctorProfile.id });

    const [appointmentCount, completedCount] = await Promise.all([
      this.prisma.appointment.count({ where: { OR: ownershipOr } }),
      this.prisma.appointment.count({
        where: { status: AppointmentStatus.COMPLETED, OR: ownershipOr },
      }),
    ]);

    return { ...user, appointmentSummary: { total: appointmentCount, completed: completedCount } };
  }

  async updateUserStatus(adminUserId: string, id: string, dto: UpdateUserStatusDto) {
    if (id === adminUserId) {
      throw new AppException(ErrorCodes.BUSINESS_RULE_VIOLATION, "You cannot change your own status");
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppException(ErrorCodes.NOT_FOUND, "User not found");
    }
    if ((dto.status === UserStatus.SUSPENDED || dto.status === UserStatus.DEACTIVATED) && !dto.reason) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, "A reason is required to suspend or deactivate an account", [
        { field: "reason", issue: "required" },
      ]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: dto.status,
          statusReason: dto.reason ?? null,
          statusChangedAt: new Date(),
        },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: dto.status === UserStatus.ACTIVE ? AuditAction.USER_ACTIVATED : dto.status === UserStatus.SUSPENDED ? AuditAction.USER_SUSPENDED : AuditAction.USER_DEACTIVATED,
          entityType: "User",
          entityId: id,
          reason: dto.reason ?? null,
        },
      });
    });

    this.events.emit({ type: "account.status_changed", userId: id, status: dto.status });
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, status: true, statusReason: true } });
  }

  async listDoctors(query: AdminDoctorsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.DoctorProfileWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.doctorProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, status: true } },
          specializations: { include: { specialization: true } },
        },
      }),
      this.prisma.doctorProfile.count({ where }),
    ]);

    return { data: rows, meta: pageMeta(total, page, pageSize) };
  }

  async reviewDoctor(adminUserId: string, id: string, dto: ReviewDoctorDto) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { id }, include: { user: { select: { id: true } } } });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Doctor profile not found");
    }
    if (dto.decision === "REJECTED" && !dto.reason) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, "A reason is required to reject a profile", [{ field: "reason", issue: "required" }]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorProfile.update({
        where: { id },
        data: {
          status: dto.decision === "APPROVED" ? DoctorStatus.APPROVED : DoctorStatus.REJECTED,
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
          reviewNote: dto.reason ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: dto.decision === "APPROVED" ? AuditAction.DOCTOR_APPROVED : AuditAction.DOCTOR_REJECTED,
          entityType: "DoctorProfile",
          entityId: id,
          reason: dto.reason ?? null,
        },
      });
    });

    this.events.emit({ type: "doctor.reviewed", userId: profile.user.id, decision: dto.decision });
    return this.prisma.doctorProfile.findUnique({ where: { id } });
  }

  async updateDoctorProfile(adminUserId: string, id: string, dto: UpdateDoctorProfileDto) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { id },
      include: { specializations: true },
    });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Doctor profile not found");
    }

    const before = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      bio: profile.bio,
      yearsOfExperience: profile.yearsOfExperience,
      consultationFee: profile.consultationFee?.toString() ?? null,
      languages: profile.languages,
      timezone: profile.timezone,
    };

    const data: Prisma.DoctorProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.title !== undefined) data.title = dto.title || null;
    if (dto.bio !== undefined) data.bio = dto.bio || null;
    if (dto.yearsOfExperience !== undefined) data.yearsOfExperience = dto.yearsOfExperience;
    if (dto.consultationFee !== undefined) data.consultationFee = dto.consultationFee;
    if (dto.languages !== undefined) data.languages = dto.languages;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.doctorProfile.update({ where: { id }, data });
      if (dto.specializationIds !== undefined || dto.primarySpecializationId !== undefined) {
        const ids = dto.specializationIds ?? profile.specializations.map((s) => s.specializationId);
        const primary = dto.primarySpecializationId ?? profile.specializations.find((s) => s.isPrimary)?.specializationId ?? ids[0];
        if (!ids.includes(primary)) {
          throw new AppException(ErrorCodes.VALIDATION_FAILED, "Primary specialization must be one of the selected specializations");
        }
        await tx.doctorSpecialization.deleteMany({ where: { doctorProfileId: id } });
        await tx.doctorSpecialization.createMany({
          data: ids.map((specializationId) => ({ doctorProfileId: id, specializationId, isPrimary: specializationId === primary })),
        });
      }
      return next;
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: AuditAction.DOCTOR_PROFILE_UPDATED,
        entityType: "DoctorProfile",
        entityId: id,
        metadata: { before, after: { firstName: updated.firstName, lastName: updated.lastName, timezone: updated.timezone } },
      },
    });

    return this.prisma.doctorProfile.findUnique({ where: { id }, include: { specializations: { include: { specialization: true } } } });
  }

  async listAppointments(query: AdminAppointmentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AppointmentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.doctorId) where.doctorProfileId = query.doctorId;
    if (query.patientId) where.patientProfileId = query.patientId;
    if (query.from || query.to) {
      where.startsAt = {};
      if (query.from) where.startsAt.gte = new Date(query.from);
      if (query.to) where.startsAt.lte = new Date(query.to);
    }
    if (query.sessionStatus) where.session = { status: query.sessionStatus };
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { patient: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
        { doctor: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
      ];
    }
    if (query.invalidOnly) {
      where.AND = [
        { status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED] } },
        { endsAt: { lt: new Date() } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startsAt: "desc" },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, title: true, avatarColor: true } },
          session: { select: { id: true, status: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data: rows, meta: pageMeta(total, page, pageSize) };
  }

  async cancelAppointment(adminUserId: string, id: string, dto: { reason?: string }) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id }, include: { session: true, patient: true, doctor: true } });
    if (!appointment) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Appointment not found");
    }
    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new AppException(ErrorCodes.INVALID_STATE_TRANSITION, "This appointment can no longer be cancelled");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: CancelledBy.ADMIN, cancellationReason: dto.reason ?? null },
      });
      if (appointment.session) {
        await tx.consultationSession.update({ where: { id: appointment.session.id }, data: { status: SessionStatus.CANCELLED } });
      }
      await tx.auditLog.create({
        data: { actorUserId: adminUserId, action: AuditAction.APPOINTMENT_CANCELLED, entityType: "Appointment", entityId: id, reason: dto.reason ?? null },
      });
    });

    this.events.emit({
      type: "appointment.cancelled",
      appointmentId: id,
      patientUserId: appointment.patient.userId,
      doctorUserId: appointment.doctor.userId,
      byRole: "ADMIN",
    });
    return this.prisma.appointment.findUnique({ where: { id } });
  }

  async resolveAppointment(adminUserId: string, id: string, dto: ResolveAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id }, include: { session: true } });
    if (!appointment || !appointment.session) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Appointment not found");
    }

    const sessionStatus = dto.action === "MARK_NO_SHOW" ? SessionStatus.NO_SHOW : SessionStatus.COMPLETED;
    const appointmentStatus = dto.action === "MARK_NO_SHOW" ? AppointmentStatus.NO_SHOW : AppointmentStatus.COMPLETED;
    const startedAt = appointment.session.startedAt ?? appointment.startsAt;
    const durationSeconds =
      dto.action === "FORCE_COMPLETE" ? Math.max(0, Math.floor((appointment.endsAt.getTime() - startedAt.getTime()) / 1000)) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.consultationSession.update({
        where: { id: appointment.session!.id },
        data: {
          status: sessionStatus,
          ...(dto.action === "FORCE_COMPLETE" ? { startedAt, endedAt: appointment.endsAt, durationSeconds } : {}),
        },
      });
      await tx.appointment.update({ where: { id }, data: { status: appointmentStatus } });
      await tx.auditLog.create({
        data: { actorUserId: adminUserId, action: AuditAction.APPOINTMENT_RESOLVED, entityType: "Appointment", entityId: id, reason: dto.reason ?? dto.action },
      });
    });

    return this.prisma.appointment.findUnique({ where: { id }, include: { session: true } });
  }

  async listAuditLogs(query: AuditLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.action) where.action = query.action as AuditAction;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: { actor: { select: { id: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: rows, meta: pageMeta(total, page, pageSize) };
  }
}
