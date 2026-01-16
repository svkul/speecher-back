import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthSignInDto } from './dto/auth.input';
import { AuthResponseDto } from './dto/auth.response';
import { CurrentUser } from '../user/decorator/user.decorator';
import { UserModel } from '../../generated/prisma/models/User';
import { AuthGuardConfig } from './decorator/auth.decorator';
import { FilteredLogger } from '../logger/filtered-logger.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly logger: FilteredLogger,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sign in with OAuth (Google or Apple)
   * POST /auth/oauth
   */
  @AuthGuardConfig({ isPublic: true })
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  async signInWithOAuth(
    @Body() oauthSignInDto: OAuthSignInDto,
    @Headers('accept-language') language?: string,
    @Headers('x-client-type') clientType?: string,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.signInWithOAuth(
      oauthSignInDto,
      language,
    );

    // For web clients (Next.js admin & Expo Web): set httpOnly cookies
    const isWebClient =
      clientType === 'nextjs-admin' || clientType === 'expo-web';

    if (response && isWebClient) {
      this.setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // Return response without tokens for web clients (tokens in cookies)
      return new AuthResponseDto(result.user, '', '');
    }

    return result;
  }

  /**
   * Sign out current user
   * POST /auth/signout
   */
  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @CurrentUser() user: UserModel | undefined,
    @Headers('x-client-type') clientType?: string,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<void> {
    await this.authService.signOut(user);

    // Clear cookies for web clients
    if (response && clientType === 'nextjs-admin') {
      this.clearAuthCookies(response);
    }
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const sameSite: 'lax' | 'none' = isProduction ? 'none' : 'lax';

    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'none';
      path: string;
      domain?: string;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: '/',
    };

    if (isProduction) {
      const cookieDomain = this.configService.get<string>('cookieDomain');
      if (cookieDomain) {
        cookieOptions.domain = cookieDomain;
      }
    }

    // Get expiry from configuration
    const accessTokenExpiry =
      this.configService.get<string>('jwt.accessTokenExpiry', {
        infer: true,
      }) || '15m';
    const refreshTokenExpiry =
      this.configService.get<string>('jwt.refreshTokenExpiry', {
        infer: true,
      }) || '7d';

    // Set access token cookie
    response.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: this.parseExpiryToMs(accessTokenExpiry),
    });

    // Set refresh token cookie
    response.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: this.parseExpiryToMs(refreshTokenExpiry),
    });

    this.logger.debug(
      `Auth cookies set successfully. Production: ${isProduction}, SameSite: ${cookieOptions.sameSite}`,
      AuthController.name,
    );
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);

    if (!match) {
      this.logger.warn(
        `Invalid expiry format: ${expiry}, using default 15m`,
        AuthController.name,
      );
      return 15 * 60 * 1000; // Default to 15 minutes
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
          AuthController.name,
        );
        return 15 * 60 * 1000;
    }
  }

  private clearAuthCookies(response: Response): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const sameSite: 'lax' | 'none' = isProduction ? 'none' : 'lax';

    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'none';
      maxAge: number;
      path: string;
      domain?: string;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge: 0,
      path: '/',
    };

    if (isProduction) {
      const cookieDomain = this.configService.get<string>('cookieDomain');
      if (cookieDomain) {
        cookieOptions.domain = cookieDomain;
      }
    }

    // Clear access token cookie
    response.cookie('accessToken', '', cookieOptions);

    // Clear refresh token cookie
    response.cookie('refreshToken', '', cookieOptions);

    this.logger.debug('Auth cookies cleared successfully', AuthController.name);
  }
}
