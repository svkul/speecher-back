import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { SpeechService } from './speech.service';
import { TtsConfigService } from '../tts/tts-config.service';
import { CurrentUser } from '../user/decorator/user.decorator';
import {
  CreateSpeechDto,
  UpdateSpeechDto,
  UpdateSpeechBlockDto,
  GenerateAudioDto,
  SpeechResponseDto,
  SpeechBlockResponseDto,
  BatchAudioGenerationResponseDto,
} from './dto';
import {
  VoicesListResponseDto,
  LanguagesListResponseDto,
  ModelsListResponseDto,
} from '../tts/dto';
import { User } from '@prisma/client';

/**
 * Controller for managing speeches and TTS operations
 */
@Controller('speeches')
export class SpeechController {
  constructor(
    private readonly speechService: SpeechService,
    private readonly ttsConfigService: TtsConfigService,
  ) {}

  /**
   * Create a new speech
   * POST /speeches
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSpeech(
    @CurrentUser() user: User,
    @Body() createSpeechDto: CreateSpeechDto,
  ): Promise<SpeechResponseDto> {
    return await this.speechService.createSpeech(user.id, createSpeechDto);
  }

  /**
   * Get all speeches for current user
   * GET /speeches
   */
  @Get()
  async getSpeeches(@CurrentUser() user: User): Promise<SpeechResponseDto[]> {
    return await this.speechService.getSpeeches(user.id);
  }

  /**
   * Get available TTS languages
   * GET /speeches/tts/languages
   */
  @Get('tts/languages')
  async getLanguages(
    @Query('refresh') refresh?: string,
  ): Promise<LanguagesListResponseDto> {
    return await this.ttsConfigService.getLanguages(refresh === 'true');
  }

  /**
   * Get available TTS voices
   * GET /speeches/tts/voices
   */
  @Get('tts/voices')
  async getVoices(
    @Query('language') language?: string,
    @Query('refresh') refresh?: string,
  ): Promise<VoicesListResponseDto> {
    if (language) {
      return await this.ttsConfigService.getVoicesByLanguage(
        language,
        refresh === 'true',
      );
    }
    return await this.ttsConfigService.getVoices(refresh === 'true');
  }

  /**
   * Get available TTS models for current user
   * GET /speeches/tts/models
   */
  @Get('tts/models')
  async getModels(@CurrentUser() user: User): Promise<ModelsListResponseDto> {
    return this.ttsConfigService.getModelsForUser(user.subscriptionTier);
  }

  /**
   * Update a speech block
   * PATCH /speeches/blocks/:blockId
   */
  @Patch('blocks/:blockId')
  @HttpCode(HttpStatus.OK)
  async updateSpeechBlock(
    @Param('blockId') blockId: string,
    @CurrentUser() user: User,
    @Body() updateBlockDto: UpdateSpeechBlockDto,
  ): Promise<SpeechBlockResponseDto> {
    return await this.speechService.updateSpeechBlock(
      blockId,
      user.id,
      updateBlockDto,
    );
  }

  /**
   * Generate audio for all blocks in a speech
   * POST /speeches/:id/generate-audio
   */
  @Post(':id/generate-audio')
  @HttpCode(HttpStatus.OK)
  async generateAudio(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() generateAudioDto?: GenerateAudioDto,
  ): Promise<BatchAudioGenerationResponseDto> {
    return await this.speechService.generateAudioForSpeech(
      id,
      user.id,
      generateAudioDto,
    );
  }

  /**
   * Get a single speech by ID
   * GET /speeches/:id
   */
  @Get(':id')
  async getSpeech(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<SpeechResponseDto> {
    return await this.speechService.getSpeech(id, user.id);
  }

  /**
   * Update a speech
   * PATCH /speeches/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateSpeech(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateSpeechDto: UpdateSpeechDto,
  ): Promise<SpeechResponseDto> {
    return await this.speechService.updateSpeech(id, user.id, updateSpeechDto);
  }

  /**
   * Delete a speech
   * DELETE /speeches/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSpeech(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.speechService.deleteSpeech(id, user.id);
  }
}
