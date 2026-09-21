import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class DoctorSearchQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  specializationId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'availableFrom must be a YYYY-MM-DD date' })
  availableFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'availableTo must be a YYYY-MM-DD date' })
  availableTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minExperience?: number;

  @IsOptional()
  @IsIn(['relevance', 'experience', 'earliestSlot'])
  sort?: 'relevance' | 'experience' | 'earliestSlot';
}

export class DoctorSlotsQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be a YYYY-MM-DD date' })
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be a YYYY-MM-DD date' })
  to!: string;
}
