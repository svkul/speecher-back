import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
import { FilteredLogger } from '../logger/filtered-logger.service';
import {
  InternalServerException,
  ValidationException,
} from '../../utils/errors';
import { SynthesizeSpeechDto } from './dto';

/**
 * Service for interacting with Google Cloud Text-to-Speech API
 */
@Injectable()
export class TtsService implements OnModuleInit {
  private ttsClient: TextToSpeechClient;

  constructor(
    private readonly logger: FilteredLogger,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.initializeTtsClient();
  }

  /**
   * Initialize Google TTS Client with credentials
   */
  private initializeTtsClient(): void {
    try {
      const keyFilePath = this.configService.get<string>(
        'googleCloud.keyFilePath',
      );
      const credentials = this.configService.get<string>(
        'googleCloud.credentials',
      );
      const projectId = this.configService.get<string>('googleCloud.projectId');

      if (keyFilePath) {
        // Use key file path
        this.ttsClient = new TextToSpeechClient({
          keyFilename: keyFilePath,
          projectId,
        });
        this.logger.log('TTS Client initialized with key file', 'TtsService');
      } else if (credentials) {
        // Use JSON credentials from environment variable
        const parsedCredentials = JSON.parse(credentials) as {
          project_id?: string;
          [key: string]: unknown;
        };
        this.ttsClient = new TextToSpeechClient({
          credentials: parsedCredentials,
          projectId: projectId || parsedCredentials.project_id,
        });
        this.logger.log(
          'TTS Client initialized with JSON credentials',
          'TtsService',
        );
      } else {
        // Use Application Default Credentials (ADC)
        this.ttsClient = new TextToSpeechClient({
          projectId,
        });
        this.logger.log('TTS Client initialized with ADC', 'TtsService');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to initialize TTS Client: ${errorMessage}`,
        errorStack,
        'TtsService',
      );
      throw new InternalServerException(
        'Failed to initialize Text-to-Speech service',
      );
    }
  }

  /**
   * Synthesize text to speech and return audio buffer
   */
  async synthesizeText(input: SynthesizeSpeechDto): Promise<Buffer> {
    try {
      const {
        text,
        languageCode,
        voiceName,
        speakingRate = 1.0,
        pitch = 0.0,
        volumeGainDb = 0.0,
        style,
      } = input;

      // Validate text length (max 5000 characters for Google TTS)
      if (text.length > 5000) {
        throw new ValidationException(
          'Text exceeds maximum length of 5000 characters',
        );
      }

      // Build synthesis input (text or SSML)
      const synthesisInput: google.cloud.texttospeech.v1.ISynthesisInput =
        this.buildSynthesisInput(text, style);

      // Configure voice settings
      const voice: google.cloud.texttospeech.v1.IVoiceSelectionParams = {
        languageCode,
        name: voiceName,
      };

      // Configure audio settings
      const audioConfig: google.cloud.texttospeech.v1.IAudioConfig = {
        audioEncoding: google.cloud.texttospeech.v1.AudioEncoding.MP3,
        speakingRate,
        pitch,
        volumeGainDb,
      };

      this.logger.log(
        `Synthesizing speech: voice=${voiceName}, chars=${text.length}`,
        'TtsService',
      );

      // Make request to Google TTS API
      const [response] = await this.ttsClient.synthesizeSpeech({
        input: synthesisInput,
        voice,
        audioConfig,
      });

      if (!response.audioContent) {
        throw new InternalServerException('No audio content received from TTS');
      }

      // Convert Uint8Array to Buffer
      const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

      this.logger.log(
        `Speech synthesized successfully: ${audioBuffer.length} bytes`,
        'TtsService',
      );

      return audioBuffer;
    } catch (error) {
      if (error instanceof ValidationException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to synthesize speech: ${errorMessage}`,
        errorStack,
        'TtsService',
      );

      throw new InternalServerException(
        `Failed to synthesize speech: ${errorMessage}`,
      );
    }
  }

  /**
   * Build synthesis input from text and optional style/SSML
   */
  private buildSynthesisInput(
    text: string,
    style?: string,
  ): google.cloud.texttospeech.v1.ISynthesisInput {
    // If style contains SSML tags, use it as SSML
    if (style && style.trim().startsWith('<speak>')) {
      return { ssml: style };
    }

    // Otherwise use plain text (style is ignored if not valid SSML)
    return { text };
  }

  /**
   * Calculate audio duration estimate (in seconds) from text length
   * Rough estimate: ~150 words per minute = ~2.5 words per second
   * Average word length: 5 characters + 1 space = 6 characters per word
   */
  calculateEstimatedDuration(text: string): number {
    const characterCount = text.length;
    const estimatedWords = characterCount / 6;
    const estimatedSeconds = Math.ceil(estimatedWords / 2.5);
    return estimatedSeconds;
  }

  /**
   * Count characters in text (for billing/quota tracking)
   */
  countCharacters(text: string): number {
    return text.length;
  }

  /**
   * Get TTS Client (for advanced operations)
   */
  getClient(): TextToSpeechClient {
    return this.ttsClient;
  }
}
