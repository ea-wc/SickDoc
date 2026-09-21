import { Transform } from "class-transformer";
import { AppointmentStatus, DoctorStatus, Role, SessionStatus, UserStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js";

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ReviewDoctorDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ResolveAppointmentDto {
  @IsIn(["MARK_NO_SHOW", "FORCE_COMPLETE"])
  action!: "MARK_NO_SHOW" | "FORCE_COMPLETE";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CancelAppointmentAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AdminDoctorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DoctorStatus)
  status?: DoctorStatus;
}

export class AdminAppointmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(SessionStatus)
  sessionStatus?: SessionStatus;

  @IsOptional()
  @IsUUID("4")
  doctorId?: string;

  @IsOptional()
  @IsUUID("4")
  patientId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  invalidOnly?: boolean;
}

export class AuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4")
  actorUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID("4")
  entityId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
