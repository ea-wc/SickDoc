import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AvailabilityRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  slotMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceAvailabilityRulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRuleDto)
  rules!: AvailabilityRuleDto[];
}

export class CreateAvailabilityExceptionDto {
  @IsDateString({ strict: true })
  startsAt!: string;

  @IsDateString({ strict: true })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
