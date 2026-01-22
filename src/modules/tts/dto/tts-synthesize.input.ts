import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TtsModel } from '../constants';

/**
 * DTO for synthesizing text to speech
 */
export class SynthesizeSpeechDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string; // e.g., "en-US", "uk-UA"

  @IsString()
  @IsNotEmpty()
  voiceName: string; // e.g., "en-US-Standard-A"

  @IsEnum(TtsModel)
  @IsOptional()
  model?: TtsModel;

  @IsString()
  @IsOptional()
  style?: string; // SSML or style instructions

  @IsOptional()
  speakingRate?: number; // 0.25 to 4.0, default 1.0

  @IsOptional()
  pitch?: number; // -20.0 to 20.0, default 0.0

  @IsOptional()
  volumeGainDb?: number; // -96.0 to 16.0, default 0.0
}
