import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtTokenService } from './jwt.service';
import { OAuthService } from './oauth.service';
import { OAuthSignInDto } from './dto/auth.input';
import { sanitizeUserId } from '../../utils/safe-logger.util';
import { UserModel } from '../../generated/prisma/models/User';
import { UserRole } from '../../generated/prisma/enums';
import { FilteredLogger } from '../logger/filtered-logger.service';
import {
  InternalServerException,
  AppException,
  ValidationException,
  UnauthorizedException,
} from '../../utils/errors';
import { AuthResponseDto } from './dto/auth.response';
import { UserResponseDto } from '../user/dto/user.response';

@Injectable()
export class AuthService {
  constructor(
    private readonly logger: FilteredLogger,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtTokenService,
    private readonly oauthService: OAuthService,
  ) {}

  async signInWithOAuth(
    input: OAuthSignInDto,
    language?: string,
  ): Promise<AuthResponseDto> {
    try {
      // Verify OAuth token
      const oauthUser = await this.oauthService.verifyOAuthToken(
        input.provider,
        input.idToken,
      );

      if (!oauthUser.email) {
        throw new ValidationException(
          'Email not provided by OAuth provider',
          'email',
        );
      }

      // Check if OAuth account exists
      const oauthAccount = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: input.provider,
            providerId: oauthUser.providerId,
          },
        },
        include: {
          user: true,
        },
      });

      let user: UserModel;

      if (oauthAccount) {
        // User exists, use their account
        user = oauthAccount.user;
      } else {
        // Check if user with this email exists
        user = await this.prisma.user.findUnique({
          where: { email: oauthUser.email.toLowerCase() },
        });

        if (user) {
          // Link OAuth account to existing user
          await this.prisma.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: input.provider,
              providerId: oauthUser.providerId,
              email: oauthUser.email,
            },
          });
        } else {
          // Create new user and link OAuth account with language from header
          user = await this.prisma.user.create({
            data: {
              email: oauthUser.email.toLowerCase(),
              firstName: oauthUser.firstName,
              lastName: oauthUser.lastName,
              avatar: oauthUser.avatar,
              role: UserRole.CUSTOMER,
              language: language || 'uk',
              oauthAccounts: {
                create: {
                  provider: input.provider,
                  providerId: oauthUser.providerId,
                  email: oauthUser.email,
                },
              },
            },
          });
        }
      }

      // Update user info if provided
      const updateData: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
        language?: string;
      } = {};
      if (oauthUser.firstName || oauthUser.lastName || oauthUser.avatar) {
        updateData.firstName = oauthUser.firstName || user.firstName;
        updateData.lastName = oauthUser.lastName || user.lastName;
        updateData.avatar = oauthUser.avatar || user.avatar;
      }
      // Update language if not set and provided
      if (language && !user.language) {
        updateData.language = language;
      }
      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      // Generate tokens
      const tokens = await this.jwtService.generateTokens(
        user.id,
        user.email,
        user.role,
      );

      return new AuthResponseDto(
        new UserResponseDto(user),
        tokens.accessToken,
        tokens.refreshToken,
      );
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `Error in signInWithOAuth for provider ${input.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        AuthService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to sign in with OAuth', {
        operation: 'signInWithOAuth',
        provider: input.provider,
      });
    }
  }

  async signOut(user: UserModel | undefined): Promise<void> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      await this.jwtService.revokeAllUserTokens(user.id);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `Error in signOut for user ${sanitizeUserId(user.id)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        AuthService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to sign out', {
        operation: 'signOut',
        userId: sanitizeUserId(user.id),
      });
    }
  }
}
