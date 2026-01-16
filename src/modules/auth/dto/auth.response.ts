import { UserResponseDto } from '../../user/dto/user.response';

/**
 * Response DTO for authentication operations that return user data and tokens
 */
export class AuthResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;

  constructor(
    user: UserResponseDto,
    accessToken: string,
    refreshToken: string,
  ) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
