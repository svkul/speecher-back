/**
 * Voice information from Google TTS
 */
export class VoiceDto {
  languageCodes: string[]; // e.g., ["en-US"]
  name: string; // e.g., "en-US-Standard-A"
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
}

/**
 * Response containing list of available voices
 */
export class VoicesListResponseDto {
  voices: VoiceDto[];
}

/**
 * Language information
 */
export class LanguageDto {
  code: string; // e.g., "en-US"
  name: string; // e.g., "English (US)"
  availableVoices: number; // Count of available voices
}

/**
 * Response containing list of available languages
 */
export class LanguagesListResponseDto {
  languages: LanguageDto[];
}

/**
 * TTS Model information
 */
export class TtsModelInfoDto {
  name: string;
  price: number; // Price per 1M characters
  freeLimit: number; // Free characters limit
  description: string;
}

/**
 * Response containing available models for user
 */
export class ModelsListResponseDto {
  models: TtsModelInfoDto[];
  recommendedModel: string; // Based on subscription tier
}
