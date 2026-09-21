import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString({ message: 'New password must be at least 10 characters' })
  @MinLength(10, { message: 'New password must be at least 10 characters' })
  @Matches(/[a-zA-Z]/, { message: 'New password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'New password must contain at least one digit' })
  newPassword!: string;
}
