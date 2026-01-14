import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for updating user profile
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
