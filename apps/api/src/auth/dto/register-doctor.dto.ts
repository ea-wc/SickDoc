import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDoctorDto {
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @IsString({ message: 'Password must be at least 10 characters' })
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one digit' })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  licenseNumber!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(70)
  yearsOfExperience?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true, message: 'specializationIds must be valid UUIDs' })
  specializationIds!: string[];

  @IsUUID('4', { message: 'primarySpecializationId must be a valid UUID' })
  primarySpecializationId!: string;
}
