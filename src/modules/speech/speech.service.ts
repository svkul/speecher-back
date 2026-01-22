import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TtsService } from '../tts/tts.service';
import { FilteredLogger } from '../logger/filtered-logger.service';
import {
  ResourceNotFoundException,
  ValidationException,
  ForbiddenException,
} from '../../utils/errors';
import {
  CreateSpeechDto,
  UpdateSpeechDto,
  UpdateSpeechBlockDto,
  GenerateAudioDto,
  SpeechResponseDto,
  SpeechBlockResponseDto,
  AudioGenerationResponseDto,
  BatchAudioGenerationResponseDto,
} from './dto';
import {
  SUBSCRIPTION_MODELS,
  SUBSCRIPTION_LIMITS,
  TRIAL_CONFIG,
  TtsModel,
} from '../tts/constants';
import { User, SpeechBlock, Prisma } from '@prisma/client';

/**
 * Types for Speech with relations
 */
type SpeechWithBlocks = Prisma.SpeechGetPayload<{
  include: { blocks: true };
}>;

/**
 * Service for managing speeches and audio generation
 */
@Injectable()
export class SpeechService {
  constructor(
    private readonly logger: FilteredLogger,
    private readonly prisma: PrismaService,
    private readonly ttsService: TtsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new speech with blocks
   */
  async createSpeech(
    userId: string,
    input: CreateSpeechDto,
  ): Promise<SpeechResponseDto> {
    // Validate trial limits
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ResourceNotFoundException('User not found');
    }

    // Check trial limits if user hasn't completed trial
    if (!user.trialUsed && input.blocks.length > TRIAL_CONFIG.maxBlocks) {
      throw new ValidationException(
        `Trial allows maximum ${TRIAL_CONFIG.maxBlocks} blocks per speech`,
      );
    }

    // Validate block character limits for trial users
    if (!user.trialUsed) {
      for (const block of input.blocks) {
        if (block.text.length > TRIAL_CONFIG.maxCharactersPerBlock) {
          throw new ValidationException(
            `Trial allows maximum ${TRIAL_CONFIG.maxCharactersPerBlock} characters per block`,
          );
        }
      }
    }

    // Create speech with blocks
    const speech = await this.prisma.speech.create({
      data: {
        userId,
        title: input.title,
        blocks: {
          create: input.blocks.map((block) => ({
            title: block.title,
            text: block.text,
            order: block.order,
            ttsLanguage:
              block.ttsLanguage ||
              this.configService.get<string>('tts.defaultLanguage'),
            ttsVoice:
              block.ttsVoice ||
              this.configService.get<string>('tts.defaultVoice'),
            ttsModel:
              (block.ttsModel as string) ||
              this.configService.get<string>('tts.defaultModel'),
            ttsStyle: block.ttsStyle,
          })),
        },
      },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    this.logger.log(
      `Speech created: ${speech.id} with ${speech.blocks.length} blocks`,
      'SpeechService',
    );

    return this.mapToSpeechResponse(speech);
  }

  /**
   * Get all speeches for a user
   */
  async getSpeeches(userId: string): Promise<SpeechResponseDto[]> {
    const speeches = await this.prisma.speech.findMany({
      where: { userId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return speeches.map((speech) => this.mapToSpeechResponse(speech));
  }

  /**
   * Get a single speech by ID
   */
  async getSpeech(
    speechId: string,
    userId: string,
  ): Promise<SpeechResponseDto> {
    const speech = await this.prisma.speech.findUnique({
      where: { id: speechId, userId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!speech) {
      throw new ResourceNotFoundException('Speech not found');
    }

    return this.mapToSpeechResponse(speech);
  }

  /**
   * Update a speech
   */
  async updateSpeech(
    speechId: string,
    userId: string,
    input: UpdateSpeechDto,
  ): Promise<SpeechResponseDto> {
    const speech = await this.prisma.speech.findUnique({
      where: { id: speechId, userId },
    });

    if (!speech) {
      throw new ResourceNotFoundException('Speech not found');
    }

    const updated = await this.prisma.speech.update({
      where: { id: speechId },
      data: input,
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapToSpeechResponse(updated);
  }

  /**
   * Delete a speech
   */
  async deleteSpeech(speechId: string, userId: string): Promise<void> {
    const speech = await this.prisma.speech.findUnique({
      where: { id: speechId, userId },
      include: { blocks: true },
    });

    if (!speech) {
      throw new ResourceNotFoundException('Speech not found');
    }

    // Delete audio files from storage
    for (const block of speech.blocks) {
      if (block.audioUrl) {
        await this.deleteAudioFile(block.audioUrl);
      }
    }

    // Delete speech (blocks will be cascade deleted)
    await this.prisma.speech.delete({
      where: { id: speechId },
    });

    this.logger.log(`Speech deleted: ${speechId}`, 'SpeechService');
  }

  /**
   * Update a speech block
   */
  async updateSpeechBlock(
    blockId: string,
    userId: string,
    input: UpdateSpeechBlockDto,
  ): Promise<SpeechBlockResponseDto> {
    const block = await this.prisma.speechBlock.findUnique({
      where: { id: blockId },
      include: { speech: true },
    });

    if (!block || block.speech.userId !== userId) {
      throw new ResourceNotFoundException('Speech block not found');
    }

    const updated = await this.prisma.speechBlock.update({
      where: { id: blockId },
      data: input,
    });

    return this.mapToBlockResponse(updated);
  }

  /**
   * Generate audio for all blocks in a speech
   */
  async generateAudioForSpeech(
    speechId: string,
    userId: string,
    settings?: GenerateAudioDto,
  ): Promise<BatchAudioGenerationResponseDto> {
    const speech = await this.prisma.speech.findUnique({
      where: { id: speechId, userId },
      include: {
        blocks: { orderBy: { order: 'asc' } },
        user: true,
      },
    });

    if (!speech) {
      throw new ResourceNotFoundException('Speech not found');
    }

    // Check monthly quota
    await this.checkMonthlyQuota(speech.user, speech.blocks);

    // Determine TTS model based on subscription
    const model = this.getModelForUser(speech.user, settings?.model);

    const results: AudioGenerationResponseDto[] = [];
    let totalCharactersUsed = 0;

    // Generate audio for each block
    for (const block of speech.blocks) {
      try {
        const result = await this.generateAudioForBlock(block, model, settings);
        results.push(result);
        totalCharactersUsed += result.charactersUsed;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error(
          `Failed to generate audio for block ${block.id}: ${errorMessage}`,
          errorStack,
          'SpeechService',
        );
        results.push({
          blockId: block.id,
          audioUrl: '',
          duration: 0,
          charactersUsed: 0,
          success: false,
          error: errorMessage,
        });
      }
    }

    // Update user's monthly character usage
    await this.updateUserCharacterUsage(userId, totalCharactersUsed);

    // Mark trial as used if applicable
    if (!speech.user.trialUsed) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { trialUsed: true },
      });
      this.logger.log(
        `Trial marked as used for user: ${userId}`,
        'SpeechService',
      );
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.log(
      `Audio generation completed: ${successCount} success, ${failureCount} failures`,
      'SpeechService',
    );

    return {
      speechId,
      results,
      totalCharactersUsed,
      successCount,
      failureCount,
    };
  }

  /**
   * Generate audio for a single block
   */
  private async generateAudioForBlock(
    block: SpeechBlock,
    model: TtsModel,
    settings?: GenerateAudioDto,
  ): Promise<AudioGenerationResponseDto> {
    const languageCode = settings?.languageCode || block.ttsLanguage || 'en-US';
    const voiceName =
      settings?.voiceName || block.ttsVoice || 'en-US-Standard-A';
    const speakingRate = settings?.speakingRate;
    const pitch = settings?.pitch;

    // Synthesize audio
    const audioBuffer = await this.ttsService.synthesizeText({
      text: block.text,
      languageCode,
      voiceName,
      model,
      style: block.ttsStyle || undefined,
      speakingRate,
      pitch,
    });

    // Save audio to storage
    const audioUrl = await this.saveAudioFile(audioBuffer, block.id);

    // Calculate duration and character count
    const duration = this.ttsService.calculateEstimatedDuration(block.text);
    const charactersUsed = this.ttsService.countCharacters(block.text);

    // Update block in database
    await this.prisma.speechBlock.update({
      where: { id: block.id },
      data: {
        audioUrl,
        duration,
        charactersUsed,
        generatedAt: new Date(),
        ttsModel: model as string,
      },
    });

    return {
      blockId: block.id,
      audioUrl,
      duration,
      charactersUsed,
      success: true,
    };
  }

  /**
   * Save audio file to storage
   */
  private async saveAudioFile(
    audioBuffer: Buffer,
    blockId: string,
  ): Promise<string> {
    const storageType = this.configService.get<string>('storage.type', 'local');

    // For now, implement local storage
    // TODO: Implement GCS, S3, R2 storage
    if (storageType === 'local') {
      const localPath =
        this.configService.get<string>('storage.localPath') || './uploads';
      const fileName = `${blockId}-${Date.now()}.mp3`;
      const filePath = path.join(localPath, fileName);

      // Ensure directory exists
      await fs.mkdir(localPath, { recursive: true });

      // Write file
      await fs.writeFile(filePath, audioBuffer);

      // Return URL (adjust based on your serving strategy)
      return `/audio/${fileName}`;
    }

    // TODO: Implement cloud storage (GCS, S3, R2)
    throw new ValidationException(
      `Storage type ${storageType} not implemented yet`,
    );
  }

  /**
   * Delete audio file from storage
   */
  private async deleteAudioFile(audioUrl: string): Promise<void> {
    try {
      const storageType = this.configService.get<string>(
        'storage.type',
        'local',
      );

      if (storageType === 'local') {
        const localPath =
          this.configService.get<string>('storage.localPath') || './uploads';
        const fileName = audioUrl.split('/').pop();
        if (fileName) {
          const filePath = path.join(localPath, fileName);
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to delete audio file ${audioUrl}: ${errorMessage}`,
        'SpeechService',
      );
    }
  }

  /**
   * Get TTS model based on user subscription and optional override
   */
  private getModelForUser(user: User, modelOverride?: TtsModel): TtsModel {
    // For trial users, always use Standard model
    if (!user.trialUsed) {
      return TRIAL_CONFIG.model;
    }

    // Use model override if provided and allowed
    if (modelOverride) {
      const allowedModel = SUBSCRIPTION_MODELS[user.subscriptionTier];
      // Allow downgrade to cheaper models, but not upgrade
      const modelPriority = {
        [TtsModel.Standard]: 1,
        [TtsModel.WaveNet]: 2,
        [TtsModel.Neural2]: 2,
        [TtsModel.Studio]: 3,
        [TtsModel.Chirp3HD]: 3,
      };

      if (modelPriority[modelOverride] <= modelPriority[allowedModel]) {
        return modelOverride;
      }
    }

    return SUBSCRIPTION_MODELS[user.subscriptionTier];
  }

  /**
   * Check if user has exceeded monthly quota
   */
  private async checkMonthlyQuota(
    user: User,
    blocks: SpeechBlock[],
  ): Promise<void> {
    const now = new Date();
    const lastReset = new Date(user.lastResetDate);

    // Reset counter if it's a new month
    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          monthlyCharactersUsed: 0,
          lastResetDate: now,
        },
      });
      user.monthlyCharactersUsed = 0;
    }

    // Calculate total characters to be used
    const totalChars = blocks.reduce(
      (sum, block) => sum + block.text.length,
      0,
    );
    const limit = SUBSCRIPTION_LIMITS[user.subscriptionTier];

    if (user.monthlyCharactersUsed + totalChars > limit) {
      throw new ForbiddenException(
        `Monthly character limit exceeded. Used: ${user.monthlyCharactersUsed}, Limit: ${limit}`,
      );
    }
  }

  /**
   * Update user's monthly character usage
   */
  private async updateUserCharacterUsage(
    userId: string,
    charactersUsed: number,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        monthlyCharactersUsed: { increment: charactersUsed },
      },
    });
  }

  /**
   * Map database model to response DTO
   */
  private mapToSpeechResponse(speech: SpeechWithBlocks): SpeechResponseDto {
    return {
      id: speech.id,
      userId: speech.userId,
      title: speech.title,
      blocks: speech.blocks.map((block) => this.mapToBlockResponse(block)),
      createdAt: speech.createdAt,
      updatedAt: speech.updatedAt,
    };
  }

  /**
   * Map block to response DTO
   */
  private mapToBlockResponse(block: SpeechBlock): SpeechBlockResponseDto {
    return {
      id: block.id,
      speechId: block.speechId,
      order: block.order,
      title: block.title,
      text: block.text,
      audioUrl: block.audioUrl,
      duration: block.duration,
      ttsLanguage: block.ttsLanguage,
      ttsVoice: block.ttsVoice,
      ttsModel: block.ttsModel,
      ttsStyle: block.ttsStyle,
      charactersUsed: block.charactersUsed,
      generatedAt: block.generatedAt,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }
}
