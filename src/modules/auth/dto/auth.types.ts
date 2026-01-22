import { Request } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Interface for authenticated user data attached to request
 */
export interface AuthUser {
  userId: string;
  email?: string;
  role?: UserRole;
}

/**
 * Interface for cookies in request
 */
export interface AuthCookies {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Express Request extended with authenticated user and cookies
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  cookies: AuthCookies & Record<string, string>;
}

/**
 * Result of token refresh operation
 */
export interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  wasRefreshed: boolean;
}

/**
 * GraphQL arguments that may contain business ID
 */
export interface BusinessIdArgs {
  id?: string;
  businessId?: string;
  [key: string]: unknown;
}
