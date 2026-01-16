import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtTokenService } from '../jwt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserModel } from '../../../generated/prisma/models/User';
import { AuthGuardConfigOptions } from './auth-guard-config.interface';
import { AUTH_GUARD_CONFIG_KEY } from '../decorator/auth.decorator';
import { FilteredLogger } from '../../logger/filtered-logger.service';
import {
  UnauthorizedException,
  SessionExpiredException,
  TokenExpiredException,
} from '../../../utils/errors';

type AuthFailReason =
  | 'missing_tokens'
  | 'session_expired'
  | 'refresh_token_invalid';

interface RequestWithUser extends Request {
  cookies: {
    accessToken?: string;
    refreshToken?: string;
  };
  user?: UserModel;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly logger: FilteredLogger,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtTokenService,
    private readonly configService: ConfigService,
  ) {}

  private unauthorized(reason: AuthFailReason) {
    switch (reason) {
      case 'session_expired':
        return new SessionExpiredException('Your session has expired');
      case 'refresh_token_invalid':
        return new TokenExpiredException(
          'Refresh token is invalid or expired',
          'refresh',
        );
      case 'missing_tokens':
      default:
        return new UnauthorizedException(
          'Authentication required',
          'Missing or invalid tokens',
        );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authGuardConfig =
      this.reflector.getAllAndOverride<AuthGuardConfigOptions>(
        AUTH_GUARD_CONFIG_KEY,
        [context.getHandler(), context.getClass()],
      );

    const handler = context.getHandler().name;

    // Get HTTP request/response for REST API
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithUser>();
    const response = httpContext.getResponse<Response>();

    const { accessToken, refreshToken } = this.extractTokenFromRequest(request);

    let accessTokenValid = false;
    let sessionExpired = false;

    if (accessToken) {
      const payload = this.jwtService.decodeToken(accessToken);

      if (payload) {
        if (authGuardConfig?.isPublic === true) {
          // For public routes, set minimal user info
          const user = await this.prisma.user.findUnique({
            where: { id: payload.userId },
          });
          if (user) {
            request.user = user;
          }
          return true;
        }

        const hashedToken = this.jwtService.hashToken(accessToken);
        const session = await this.prisma.session.findUnique({
          where: {
            userId: payload.userId,
            token: hashedToken,
          },
        });

        if (session) {
          if (session.expiresAt <= new Date()) {
            sessionExpired = true;
          } else {
            await this.prisma.session.update({
              where: { id: session.id },
              data: { lastUsedAt: new Date() },
            });

            // Load full user model
            const user = await this.prisma.user.findUnique({
              where: { id: payload.userId },
            });
            if (user) {
              request.user = user;
            }

            accessTokenValid = true;
            return true;
          }
        }
      }
    }

    if (refreshToken && (!accessTokenValid || sessionExpired)) {
      const payload = this.jwtService.decodeToken(refreshToken);

      if (payload) {
        const hashedToken = this.jwtService.hashToken(refreshToken);

        const session = await this.prisma.session.findUnique({
          where: {
            userId: payload.userId,
            refreshToken: hashedToken,
          },
        });

        if (session && session.refreshExpiresAt > new Date()) {
          const newTokens = await this.jwtService.generateTokens(
            payload.userId,
            payload.email,
            payload.role,
          );

          const newPayload = await this.jwtService.verifyToken(
            newTokens.accessToken,
          );

          // Load full user model
          const user = await this.prisma.user.findUnique({
            where: { id: newPayload.userId },
          });
          if (user) {
            request.user = user;
          }

          // For web clients (Next.js admin & Expo Web): set httpOnly cookies
          const clientType = request.headers['x-client-type'];
          const isWebClient =
            clientType === 'nextjs-admin' || clientType === 'expo-web';

          if (response && isWebClient) {
            this.setAuthCookies(response, {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            });
          }

          await this.prisma.session.delete({
            where: { id: session.id },
          });

          return true;
        } else if (session) {
          // Session exists but refresh token is expired, delete it
          await this.prisma.session.delete({
            where: { id: session.id },
          });
        }
      }
    }

    if (sessionExpired) {
      throw new SessionExpiredException('Your session has expired');
    }

    if (
      authGuardConfig?.isPublic ||
      handler === 'signOut' ||
      handler === 'refreshToken'
    ) {
      return true;
    }

    throw this.unauthorized('missing_tokens');
  }

  private extractTokenFromRequest(request: RequestWithUser): {
    accessToken: string | undefined;
    refreshToken: string | undefined;
  } {
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    if (request?.cookies?.accessToken) {
      accessToken = request.cookies.accessToken;
    }

    if (request?.cookies?.refreshToken) {
      refreshToken = request.cookies.refreshToken;
    }

    if (
      request?.headers?.authorization &&
      request?.headers?.['x-refresh-token']
    ) {
      accessToken = request.headers.authorization.substring(7);
      refreshToken = request.headers['x-refresh-token'] as string;
    }

    return { accessToken, refreshToken };
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    const accessTokenExpiry =
      this.configService.get<string>('jwt.accessTokenExpiry', {
        infer: true,
      }) || '15m';
    const refreshTokenExpiry =
      this.configService.get<string>('jwt.refreshTokenExpiry', {
        infer: true,
      }) || '7d';

    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: this.parseExpiryToMs(accessTokenExpiry),
      path: '/',
      ...(isProduction && {
        domain: this.configService.get('cookieDomain'),
      }),
    });

    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: this.parseExpiryToMs(refreshTokenExpiry),
      path: '/',
      ...(isProduction && {
        domain: this.configService.get('cookieDomain'),
      }),
    });

    this.logger.debug('Auth cookies set successfully', AuthGuard.name);
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);

    if (!match) {
      this.logger.warn(
        `Invalid expiry format: ${expiry}, using default 15m`,
        AuthGuard.name,
      );
      return 15 * 60 * 1000;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        this.logger.warn(
          `Unknown expiry unit: ${unit}, using default 15m`,
          AuthGuard.name,
        );
        return 15 * 60 * 1000;
    }
  }
}
