import { Transform } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

/** Coerces a repeatable query param (string | string[]) into an array. */
function toArray({ value }: { value: unknown }): unknown {
  if (value == null || value === '') return undefined;
  return Array.isArray(value) ? value : [value];
}

export class BookAppointmentDto {
  @IsUUID('4')
  doctorId!: string;

  @IsDateString({ strict: true })
  startsAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  symptomIds?: string[];
}

export class RescheduleAppointmentDto {
  @IsDateString({ strict: true })
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ListAppointmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppointmentStatus, { each: true })
  status?: AppointmentStatus[];

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  scope?: 'upcoming' | 'past' | 'all';
}
