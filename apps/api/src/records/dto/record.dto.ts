import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  subjective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objective?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  assessment!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  plan!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  summary!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  followUpAt?: string;
}

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  subjective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  assessment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  plan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  followUpAt?: string;
}

export class PrescriptionItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  drugName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  dosage!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  frequency!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validUntil must be a YYYY-MM-DD date' })
  validUntil?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}

export class RecordsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['appointments', 'notes', 'prescriptions'])
  type?: 'appointments' | 'notes' | 'prescriptions';

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
