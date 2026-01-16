import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

import { OAuthProvider } from './dto/auth.input';
import { sanitizeEmail } from '../../utils/safe-logger.util';
import { FilteredLogger } from '../logger/filtered-logger.service';
import {
  UnauthorizedException,
  InternalServerException,
  AppException,
} from '../../utils/errors';

export interface OAuthUserInfo {
  providerId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

@Injectable()
export class OAuthService {
  private googleClient: OAuth2Client;
  private googleClientIds: string[];

  constructor(
    private readonly logger: FilteredLogger,
    private readonly configService: ConfigService,
  ) {
    // Collect all Google Client IDs for different platforms
    this.googleClientIds = [
      this.configService.get<string>('oauth.google.clientIdWeb', {
        infer: true,
      }),
      this.configService.get<string>('oauth.google.clientIdIos', {
        infer: true,
      }),
      this.configService.get<string>('oauth.google.clientIdAndroid', {
        infer: true,
      }),
    ].filter((id): id is string => !!id && id.length > 0);

    if (this.googleClientIds.length > 0) {
      this.googleClient = new OAuth2Client();
    }
  }

  async verifyOAuthToken(
    provider: OAuthProvider,
    idToken: string,
  ): Promise<OAuthUserInfo> {
    switch (provider) {
      case OAuthProvider.GOOGLE:
        return this.verifyGoogleToken(idToken);
      case OAuthProvider.APPLE:
        return this.verifyAppleToken(idToken);
      default:
        throw new UnauthorizedException(
          'Unsupported OAuth provider',
          'The provided OAuth provider is not supported',
        );
    }
  }

  private async verifyGoogleToken(idToken: string): Promise<OAuthUserInfo> {
    try {
      if (!this.googleClient || this.googleClientIds.length === 0) {
        throw new UnauthorizedException(
          'Google OAuth not configured',
          'Google OAuth is not properly configured on the server',
        );
      }

      // Verify token with all registered client IDs (Web, iOS, Android)
      // This allows tokens from any platform to be verified
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientIds, // Accept tokens from all platforms
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException(
          'Invalid Google token payload',
          'The Google token payload is missing or invalid',
        );
      }

      const userInfo = {
        providerId: payload.sub,
        email: payload.email || '',
        emailVerified: payload.email_verified || false,
        firstName: payload.given_name,
        lastName: payload.family_name,
        avatar: payload.picture,
      };

      this.logger.log(
        `Google token verified successfully for user: ${sanitizeEmail(userInfo.email)} (audience: ${payload.aud})`,
        OAuthService.name,
      );

      return userInfo;
    } catch (error: unknown) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `Error verifying Google token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        OAuthService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to verify Google token', {
        operation: 'verifyGoogleToken',
      });
    }
  }

  private async verifyAppleToken(idToken: string): Promise<OAuthUserInfo> {
    try {
      const appleClientId = this.configService.get<string>(
        'oauth.apple.clientId',
        { infer: true },
      );

      if (!appleClientId) {
        throw new UnauthorizedException(
          'Apple OAuth not configured',
          'Apple OAuth is not properly configured on the server',
        );
      }

      // Verify the token with Apple's public keys
      const { sub, email, email_verified } = await appleSignin.verifyIdToken(
        idToken,
        {
          audience: appleClientId,
          ignoreExpiration: false,
        },
      );

      const userInfo: OAuthUserInfo = {
        providerId: sub,
        email: email || '',
        emailVerified: email_verified === 'true' || email_verified === true,
        // Apple doesn't always provide name in token
        // Name is only available on first sign-in
      };

      this.logger.log(
        `Apple token verified successfully for user: ${sanitizeEmail(userInfo.email)}`,
        OAuthService.name,
      );

      return userInfo;
    } catch (error: unknown) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `Error verifying Apple token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        OAuthService.name,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerException('Failed to verify Apple token', {
        operation: 'verifyAppleToken',
      });
    }
  }
}
