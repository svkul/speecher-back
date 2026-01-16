import { SetMetadata } from '@nestjs/common';
import { AuthGuardConfigOptions } from '../guard/auth-guard-config.interface';

export const AUTH_GUARD_CONFIG_KEY = 'authGuardConfig';

/**
 * Decorator to configure unified guard checks
 * @example
 * @AuthGuardConfig({ isPublic: true })
 */
export const AuthGuardConfig = (config: AuthGuardConfigOptions) =>
  SetMetadata(AUTH_GUARD_CONFIG_KEY, config);
