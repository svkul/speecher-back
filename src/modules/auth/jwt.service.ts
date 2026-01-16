import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../../generated/prisma/enums';
import * as crypto from 'crypto';
import { sanitizeUserId, sanitizeEmail } from '../../utils/safe-logger.util';
import { FilteredLogger } from '../logger/filtered-logger.service';
import {
  UnauthorizedException,
  SessionExpiredException,
  TokenExpiredException,
  InternalServerException,
  AppException,
} from '../../utils/errors';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  role: UserRole;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly logger: FilteredLogger,
    private readonly configService: ConfigService,
    private readonly jwtService: NestJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generateTokens(userId: string, email: string, role: UserRole) {
    const secret = this.configService.get<string>('jwt.secret', {
      infer: true,
    });
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret', {
      infer: true,
    });
    const accessExpiry =
      this.configService.get<string>('jwt.accessTokenExpiry', {
        infer: true,
      }) || '15m';
    const refreshExpiry =
      this.configService.get<string>('jwt.refreshTokenExpiry', {
        infer: true,
      }) || '7d';

    const accessToken = this.jwtService.sign(
      {
        userId: userId,
        email,
        type: 'access',
        role: role,
      },
      {
        secret,
        expiresIn: accessExpiry,
      } as JwtSignOptions,
    );

    const refreshToken = this.jwtService.sign(
      {
        userId: userId,
        email,
        type: 'refresh',
        role: role,
      },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
      } as JwtSignOptions,
    );

    // Calculate expiry dates
    const accessTokenExpiry = this.parseExpiry(accessExpiry);
    const refreshTokenExpiry = this.parseExpiry(refreshExpiry);

    // Store session in database
    try {
      await this.prisma.session.create({
        data: {
          userId,
          token: this.hashToken(accessToken),
          refreshToken: this.hashToken(refreshToken),
          expiresAt: accessTokenExpiry,
          refreshExpiresAt: refreshTokenExpiry,
        },
      });

      this.logger.log(
        `Tokens generated successfully for user ${sanitizeUserId(userId)} (${sanitizeEmail(email)})`,
        JwtTokenService.name,
      );
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      // Prisma errors are handled by GraphQLExceptionFilter
      this.logger.error(
        `Error generating tokens for user ${sanitizeUserId(userId)} (${sanitizeEmail(email)}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to generate tokens', {
        operation: 'generateTokens',
        userId: sanitizeUserId(userId),
      });
    }

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
    };
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const payload = this.jwtService.decode<JwtPayload>(token);
      if (!payload || typeof payload !== 'object' || !payload.userId) {
        return null;
      }
      return payload;
    } catch (error) {
      this.logger.debug(
        `Token decode error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
      );
      return null;
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret', { infer: true }),
      });

      // Check if session exists and is not expired
      const hashedToken = this.hashToken(token);
      const session = await this.prisma.session.findUnique({
        where: { userId: payload.userId, token: hashedToken },
      });

      if (!session) {
        throw new SessionExpiredException('Session not found or invalid');
      }

      if (session.expiresAt < new Date()) {
        throw new SessionExpiredException('Your session has expired');
      }

      // Update last used timestamp
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      return payload;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      // Check if it's an expected error (expired token)
      const isExpectedError =
        error instanceof Error &&
        (error.name === 'TokenExpiredError' ||
          error.message?.includes('expired') ||
          error.message?.includes('jwt expired'));

      if (isExpectedError) {
        this.logger.debug(
          `Token expired: ${error instanceof Error ? error.message : 'Unknown error'}`,
          JwtTokenService.name,
        );

        throw new TokenExpiredException('Token has expired', 'access');
      }

      // Prisma errors are handled by GraphQLExceptionFilter
      this.logger.error(
        `Token verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      const refreshSecret = this.configService.get<string>(
        'jwt.refreshSecret',
        { infer: true },
      );
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException(
          'Invalid token type',
          'Expected refresh token',
        );
      }

      // Find session by refresh token
      const hashedRefreshToken = this.hashToken(refreshToken);
      // Debug logging
      this.logger.debug(
        `Looking for session with refresh token hash: ${hashedRefreshToken.substring(0, 16)}... for user ${sanitizeUserId(payload.userId)}`,
        JwtTokenService.name,
      );

      const session = await this.prisma.session.findUnique({
        where: { userId: payload.userId, refreshToken: hashedRefreshToken },
        include: { user: true },
      });

      if (!session) {
        // Find all sessions for this user to help debug
        const userSessions = await this.prisma.session.findMany({
          where: { userId: payload.userId },
          select: { refreshToken: true },
        });

        this.logger.warn(
          `Refresh token session not found in database for user ${sanitizeUserId(payload.userId)}. ` +
            `Looking for hash: ${hashedRefreshToken.substring(0, 16)}... ` +
            `User has ${userSessions.length} session(s) in database. ` +
            `Session refresh token hashes: ${userSessions.map((s) => s.refreshToken.substring(0, 16)).join(', ')}... ` +
            `This usually means the client has an outdated refresh token that was already used or invalidated.`,
          JwtTokenService.name,
        );

        throw new TokenExpiredException(
          'Refresh token not found or invalid',
          'refresh',
        );
      }

      if (session.refreshExpiresAt < new Date()) {
        this.logger.warn(
          `Refresh token session expired for user ${sanitizeUserId(payload.userId)}. ` +
            `Expired at: ${session.refreshExpiresAt.toISOString()}, Current time: ${new Date().toISOString()}`,
          JwtTokenService.name,
        );
        throw new TokenExpiredException('Refresh token has expired', 'refresh');
      }

      await this.prisma.session.delete({
        where: { id: session.id },
      });

      return this.generateTokens(
        session.userId,
        session.user.email,
        session.user.role,
      );
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      // Prisma errors are handled by GraphQLExceptionFilter
      this.logger.error(
        `Refresh token error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to refresh tokens', {
        operation: 'refreshTokens',
      });
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    const hashedToken = this.hashToken(token);

    try {
      const result = await this.prisma.session.deleteMany({
        where: { token: hashedToken },
      });

      this.logger.log(
        `Attempting to revoke session. Sessions deleted: ${result.count}`,
        JwtTokenService.name,
      );

      if (result.count === 0) {
        this.logger.warn(
          'No session found for the provided token (may be already deleted or expired)',
          JwtTokenService.name,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      // Prisma errors are handled by GraphQLExceptionFilter
      this.logger.error(
        `Error revoking token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to revoke token', {
        operation: 'revokeToken',
      });
    }
  }

  async revokeAllUserTokens(userId: string) {
    try {
      const result = await this.prisma.session.deleteMany({
        where: { userId },
      });

      this.logger.log(
        `Revoked all tokens for user ${sanitizeUserId(userId)}. Sessions deleted: ${result.count}`,
        JwtTokenService.name,
      );
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      // Prisma errors are handled by GraphQLExceptionFilter
      this.logger.error(
        `Error revoking all tokens for user ${sanitizeUserId(userId)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        JwtTokenService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to revoke all user tokens', {
        operation: 'revokeAllUserTokens',
        userId: sanitizeUserId(userId),
      });
    }
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): Date {
    const now = new Date();
    const match = expiry.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        now.setSeconds(now.getSeconds() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
    }

    return now;
  }
}
