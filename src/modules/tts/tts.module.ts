import { Module } from '@nestjs/common';
import { TtsService } from './tts.service';
import { TtsConfigService } from './tts-config.service';

/**
 * Module for Google Cloud Text-to-Speech integration
 * Provides services for synthesizing speech and managing TTS configuration
 */
@Module({
  providers: [TtsService, TtsConfigService],
  exports: [TtsService, TtsConfigService],
})
export class TtsModule {}
