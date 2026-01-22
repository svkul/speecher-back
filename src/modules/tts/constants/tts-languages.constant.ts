/**
 * Supported languages for TTS
 * This is a subset of commonly used languages. The full list can be fetched dynamically
 * from Google TTS API via the TtsConfigService.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'uk-UA', name: 'Ukrainian' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
] as const;

/**
 * Default voices for each language (Standard model)
 * These are fallback voices when dynamic voice list is not available
 */
export const DEFAULT_VOICES: Record<string, string[]> = {
  'en-US': [
    'en-US-Standard-A',
    'en-US-Standard-B',
    'en-US-Standard-C',
    'en-US-Standard-D',
  ],
  'en-GB': [
    'en-GB-Standard-A',
    'en-GB-Standard-B',
    'en-GB-Standard-C',
    'en-GB-Standard-D',
  ],
  'en-AU': ['en-AU-Standard-A', 'en-AU-Standard-B', 'en-AU-Standard-C'],
  'uk-UA': ['uk-UA-Standard-A'], // Ukrainian (if available)
  'ru-RU': [
    'ru-RU-Standard-A',
    'ru-RU-Standard-B',
    'ru-RU-Standard-C',
    'ru-RU-Standard-D',
  ],
  'fr-FR': [
    'fr-FR-Standard-A',
    'fr-FR-Standard-B',
    'fr-FR-Standard-C',
    'fr-FR-Standard-D',
  ],
  'de-DE': [
    'de-DE-Standard-A',
    'de-DE-Standard-B',
    'de-DE-Standard-C',
    'de-DE-Standard-D',
  ],
  'es-ES': ['es-ES-Standard-A', 'es-ES-Standard-B', 'es-ES-Standard-C'],
  'it-IT': ['it-IT-Standard-A', 'it-IT-Standard-B', 'it-IT-Standard-C'],
  'pl-PL': [
    'pl-PL-Standard-A',
    'pl-PL-Standard-B',
    'pl-PL-Standard-C',
    'pl-PL-Standard-D',
  ],
  'pt-BR': ['pt-BR-Standard-A', 'pt-BR-Standard-B', 'pt-BR-Standard-C'],
  'ja-JP': [
    'ja-JP-Standard-A',
    'ja-JP-Standard-B',
    'ja-JP-Standard-C',
    'ja-JP-Standard-D',
  ],
  'ko-KR': [
    'ko-KR-Standard-A',
    'ko-KR-Standard-B',
    'ko-KR-Standard-C',
    'ko-KR-Standard-D',
  ],
  'zh-CN': [
    'zh-CN-Standard-A',
    'zh-CN-Standard-B',
    'zh-CN-Standard-C',
    'zh-CN-Standard-D',
  ],
} as const;
