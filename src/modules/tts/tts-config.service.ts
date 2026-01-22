import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilteredLogger } from '../logger/filtered-logger.service';
import { InternalServerException } from '../../utils/errors';
import { TtsService } from './tts.service';
import {
  VoiceDto,
  VoicesListResponseDto,
  LanguageDto,
  LanguagesListResponseDto,
  TtsModelInfoDto,
  ModelsListResponseDto,
} from './dto';
import {
  TTS_MODEL_PRICING,
  SUBSCRIPTION_MODELS,
  SUPPORTED_LANGUAGES,
} from './constants';
import { SubscriptionTier } from '@prisma/client';

/**
 * Service for managing TTS configuration, voices, and languages
 * Implements caching to reduce API calls
 */
@Injectable()
export class TtsConfigService {
  private voicesCache: VoiceDto[] | null = null;
  private cacheExpiryTime: Date | null = null;
  private readonly cacheTTL: number;
  private readonly cacheEnabled: boolean;

  constructor(
    private readonly logger: FilteredLogger,
    private readonly configService: ConfigService,
    private readonly ttsService: TtsService,
  ) {
    this.cacheEnabled = this.configService.get<boolean>(
      'tts.cacheVoicesList',
      true,
    );
    this.cacheTTL = this.configService.get<number>(
      'tts.cacheVoicesTTL',
      86400000,
    ); // 24h default
  }

  /**
   * Get all available voices from Google TTS
   * Uses caching to reduce API calls
   */
  async getVoices(refresh = false): Promise<VoicesListResponseDto> {
    try {
      const now = new Date();

      // Check cache
      if (
        !refresh &&
        this.cacheEnabled &&
        this.voicesCache &&
        this.cacheExpiryTime &&
        now < this.cacheExpiryTime
      ) {
        this.logger.log('Returning cached voices list', 'TtsConfigService');
        return { voices: this.voicesCache };
      }

      // Fetch from Google TTS API
      this.logger.log(
        'Fetching voices from Google TTS API',
        'TtsConfigService',
      );
      const client = this.ttsService.getClient();
      const [result] = await client.listVoices({});

      if (!result.voices || result.voices.length === 0) {
        throw new InternalServerException('No voices returned from TTS API');
      }

      // Map to DTO
      const voices: VoiceDto[] = result.voices.map((voice) => ({
        languageCodes: voice.languageCodes || [],
        name: voice.name || '',
        ssmlGender:
          (voice.ssmlGender as 'MALE' | 'FEMALE' | 'NEUTRAL') || 'NEUTRAL',
        naturalSampleRateHertz: voice.naturalSampleRateHertz || 24000,
      }));

      // Update cache
      if (this.cacheEnabled) {
        this.voicesCache = voices;
        this.cacheExpiryTime = new Date(now.getTime() + this.cacheTTL);
        this.logger.log(
          `Voices cached (${voices.length} voices, TTL: ${this.cacheTTL}ms)`,
          'TtsConfigService',
        );
      }

      return { voices };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to fetch voices: ${errorMessage}`,
        errorStack,
        'TtsConfigService',
      );
      throw new InternalServerException(
        `Failed to fetch available voices: ${errorMessage}`,
      );
    }
  }

  /**
   * Get voices filtered by language
   */
  async getVoicesByLanguage(
    languageCode: string,
    refresh = false,
  ): Promise<VoicesListResponseDto> {
    const { voices } = await this.getVoices(refresh);

    const filteredVoices = voices.filter((voice) =>
      voice.languageCodes.includes(languageCode),
    );

    return { voices: filteredVoices };
  }

  /**
   * Get list of supported languages
   */
  async getLanguages(refresh = false): Promise<LanguagesListResponseDto> {
    try {
      const { voices } = await this.getVoices(refresh);

      // Extract unique languages from voices
      const languageMap = new Map<string, number>();

      voices.forEach((voice) => {
        voice.languageCodes.forEach((code) => {
          languageMap.set(code, (languageMap.get(code) || 0) + 1);
        });
      });

      // Map to DTO with names from constants
      const languages: LanguageDto[] = Array.from(languageMap.entries()).map(
        ([code, count]) => {
          const languageInfo = SUPPORTED_LANGUAGES.find((l) => l.code === code);
          return {
            code,
            name: languageInfo?.name || code,
            availableVoices: count,
          };
        },
      );

      // Sort by code
      languages.sort((a, b) => a.code.localeCompare(b.code));

      return { languages };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to fetch languages: ${errorMessage}`,
        errorStack,
        'TtsConfigService',
      );
      throw new InternalServerException(
        `Failed to fetch available languages: ${errorMessage}`,
      );
    }
  }

  /**
   * Get available models for a user based on their subscription tier
   */
  getModelsForUser(subscriptionTier: SubscriptionTier): ModelsListResponseDto {
    const recommendedModel = SUBSCRIPTION_MODELS[subscriptionTier];

    const models: TtsModelInfoDto[] = Object.entries(TTS_MODEL_PRICING).map(
      ([name, info]) => ({
        name,
        price: info.price,
        freeLimit: info.freeLimit,
        description: info.description,
      }),
    );

    return {
      models,
      recommendedModel,
    };
  }

  /**
   * Clear voices cache
   */
  clearCache(): void {
    this.voicesCache = null;
    this.cacheExpiryTime = null;
    this.logger.log('Voices cache cleared', 'TtsConfigService');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    enabled: boolean;
    cached: boolean;
    expiresAt: Date | null;
    voiceCount: number;
  } {
    return {
      enabled: this.cacheEnabled,
      cached: this.voicesCache !== null,
      expiresAt: this.cacheExpiryTime,
      voiceCount: this.voicesCache?.length || 0,
    };
  }
}
