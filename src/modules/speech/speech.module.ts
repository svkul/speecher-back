import { Module } from '@nestjs/common';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';
import { TtsModule } from '../tts/tts.module';

/**
 * Module for managing speeches and audio generation
 */
@Module({
  imports: [TtsModule],
  controllers: [SpeechController],
  providers: [SpeechService],
  exports: [SpeechService],
})
export class SpeechModule {}
