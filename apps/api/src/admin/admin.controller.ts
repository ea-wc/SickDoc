import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { AuthenticatedUser } from "../common/auth.types.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { UpdateDoctorProfileDto } from "../doctors/dto/update-doctor-profile.dto.js";
import { AdminService } from "./admin.service.js";
import {
  AdminAppointmentsQueryDto,
  AdminDoctorsQueryDto,
  AdminUsersQueryDto,
  AuditLogsQueryDto,
  CancelAppointmentAdminDto,
  ResolveAppointmentDto,
  ReviewDoctorDto,
  UpdateUserStatusDto,
} from "./dto/admin.dto.js";

/** Admin console (docs/API_SPEC.md §12). All routes require ADMIN. */
@Controller("admin")
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("dashboard")
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get("users")
  users(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get("users/:id")
  user(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Patch("users/:id/status")
  status(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(user.id, id, dto);
  }

  @Get("doctors")
  doctors(@Query() query: AdminDoctorsQueryDto) {
    return this.adminService.listDoctors(query);
  }

  @Patch("doctors/:id/review")
  review(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReviewDoctorDto) {
    return this.adminService.reviewDoctor(user.id, id, dto);
  }

  @Patch("doctors/:id/profile")
  profile(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateDoctorProfileDto) {
    return this.adminService.updateDoctorProfile(user.id, id, dto);
  }

  @Get("appointments")
  appointments(@Query() query: AdminAppointmentsQueryDto) {
    return this.adminService.listAppointments(query);
  }

  @Patch("appointments/:id/cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CancelAppointmentAdminDto) {
    return this.adminService.cancelAppointment(user.id, id, dto);
  }

  @Patch("appointments/:id/resolve")
  resolve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ResolveAppointmentDto) {
    return this.adminService.resolveAppointment(user.id, id, dto);
  }

  @Get("audit-logs")
  auditLogs(@Query() query: AuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }
}
