import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TtsModel } from 'src/modules/tts/constants';

/**
 * DTO for creating a speech block
 */
export class CreateSpeechBlockDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsNumber()
  @Min(1)
  order: number;

  // TTS settings (optional, will use defaults if not provided)
  @IsString()
  @IsOptional()
  ttsLanguage?: string; // e.g., "en-US"

  @IsString()
  @IsOptional()
  ttsVoice?: string; // e.g., "en-US-Standard-A"

  @IsEnum(TtsModel)
  @IsOptional()
  ttsModel?: TtsModel;

  @IsString()
  @IsOptional()
  ttsStyle?: string; // SSML or style instructions
}

/**
 * DTO for creating a speech
 */
export class CreateSpeechDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpeechBlockDto)
  blocks: CreateSpeechBlockDto[];
}

/**
 * DTO for updating a speech
 */
export class UpdateSpeechDto {
  @IsString()
  @IsOptional()
  title?: string;
}

/**
 * DTO for updating a speech block
 */
export class UpdateSpeechBlockDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  ttsLanguage?: string;

  @IsString()
  @IsOptional()
  ttsVoice?: string;

  @IsEnum(TtsModel)
  @IsOptional()
  ttsModel?: TtsModel;

  @IsString()
  @IsOptional()
  ttsStyle?: string;
}

/**
 * DTO for generating audio for speech blocks
 */
export class GenerateAudioDto {
  @IsString()
  @IsOptional()
  languageCode?: string; // Override default language

  @IsString()
  @IsOptional()
  voiceName?: string; // Override default voice

  @IsEnum(TtsModel)
  @IsOptional()
  model?: TtsModel; // Override model (if allowed by subscription)

  @IsNumber()
  @IsOptional()
  speakingRate?: number; // 0.25 to 4.0

  @IsNumber()
  @IsOptional()
  pitch?: number; // -20.0 to 20.0
}
