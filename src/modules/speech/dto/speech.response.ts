/**
 * Speech Block response DTO
 */
export class SpeechBlockResponseDto {
  id: string;
  speechId: string;
  order: number;
  title: string;
  text: string;
  audioUrl: string | null;
  duration: number | null;
  ttsLanguage: string | null;
  ttsVoice: string | null;
  ttsModel: string | null;
  ttsStyle: string | null;
  charactersUsed: number | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Speech response DTO
 */
export class SpeechResponseDto {
  id: string;
  userId: string;
  title: string;
  blocks: SpeechBlockResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response for audio generation
 */
export class AudioGenerationResponseDto {
  blockId: string;
  audioUrl: string;
  duration: number;
  charactersUsed: number;
  success: boolean;
  error?: string;
}

/**
 * Response for batch audio generation
 */
export class BatchAudioGenerationResponseDto {
  speechId: string;
  results: AudioGenerationResponseDto[];
  totalCharactersUsed: number;
  successCount: number;
  failureCount: number;
}
