import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterPatientDto {
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date, expected YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
