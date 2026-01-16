import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

/**
 * DTO for OAuth sign in request
 */
export class OAuthSignInDto {
  @IsEnum(OAuthProvider)
  @IsNotEmpty()
  provider: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  idToken: string;
}

/**
 * DTO for refresh token request
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
