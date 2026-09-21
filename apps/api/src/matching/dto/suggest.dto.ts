import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class SuggestDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'symptomIds must be valid UUIDs' })
  symptomIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  freeText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
