import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { FilteredLogger } from '../logger/filtered-logger.service';
import { InternalServerException } from '../../utils/errors';

/**
 * Service for managing file storage in Google Cloud Storage
 * Handles upload, download, and deletion of audio files
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private storage: Storage;
  private bucketName: string;

  constructor(
    private readonly logger: FilteredLogger,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeStorage();
  }

  /**
   * Initialize Google Cloud Storage client
   */
  private async initializeStorage(): Promise<void> {
    try {
      const keyFilePath = this.configService.get<string>(
        'googleCloud.keyFilePath',
      );
      const credentials = this.configService.get<string>(
        'googleCloud.credentials',
      );
      const projectId = this.configService.get<string>('googleCloud.projectId');

      this.bucketName =
        this.configService.get<string>('storage.bucketName') || '';

      if (!this.bucketName) {
        throw new Error('Storage bucket name is not configured');
      }

      // Initialize Storage client with same credentials as TTS
      if (keyFilePath) {
        this.storage = new Storage({
          keyFilename: keyFilePath,
          projectId,
        });
      } else if (credentials) {
        const parsedCredentials = JSON.parse(credentials) as {
          project_id?: string;
          client_email?: string;
          [key: string]: unknown;
        };

        this.storage = new Storage({
          credentials: parsedCredentials,
          projectId: projectId || parsedCredentials.project_id,
        });
      } else {
        // Use Application Default Credentials
        this.storage = new Storage({ projectId });
      }

      // Verify bucket exists
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();

      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : typeof error;

      this.logger.error(
        `Failed to initialize Storage: ${errorMessage}`,
        errorStack,
        'StorageService',
      );
      // Enhanced error logging
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
        name: errorName,
        bucketName: this.bucketName,
      };

      if (error && typeof error === 'object') {
        Object.keys(error).forEach((key) => {
          if (!['message', 'stack', 'name'].includes(key)) {
            errorDetails[key] = (error as Record<string, unknown>)[key];
          }
        });
      }

      throw new InternalServerException('Failed to initialize storage service');
    }
  }

  /**
   * Upload audio file to GCS
   * @param buffer - Audio file buffer
   * @param userId - User ID for folder structure
   * @param speechId - Speech ID for folder structure
   * @param blockId - Block ID for unique filename
   * @returns Public URL of the uploaded file
   */
  async uploadAudioFile(
    buffer: Buffer,
    userId: string,
    speechId: string,
    blockId: string,
  ): Promise<string> {
    // Generate file path: users/{userId}/speeches/{speechId}/{blockId}-{timestamp}.mp3
    const timestamp = Date.now();
    const fileName = `${blockId}-${timestamp}.mp3`;
    const filePath = `users/${userId}/speeches/${speechId}/${fileName}`;

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      // Upload file with metadata
      await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      this.logger.log(
        `File uploaded successfully: ${filePath} (${buffer.length} bytes)`,
        'StorageService',
      );

      return publicUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : typeof error;

      // Log error details including any additional properties
      const errorDetails: Record<string, unknown> = {
        message: errorMessage,
        name: errorName,
        filePath,
        bucketName: this.bucketName,
        bufferSize: buffer.length,
      };

      // Extract additional error properties (like code, statusCode, etc.)
      if (error && typeof error === 'object') {
        Object.keys(error).forEach((key) => {
          if (!['message', 'stack', 'name'].includes(key)) {
            errorDetails[key] = (error as Record<string, unknown>)[key];
          }
        });
      }

      throw new InternalServerException(
        `Failed to upload audio file: ${errorMessage}`,
      );
    }
  }

  /**
   * Delete audio file from GCS
   * @param fileUrl - Public URL or file path
   */
  async deleteAudioFile(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const filePath = this.extractFilePathFromUrl(fileUrl);

      if (!filePath) {
        return;
      }

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      // Check if file exists before deleting
      const [exists] = await file.exists();
      if (!exists) {
        this.logger.warn(`File not found: ${filePath}`, 'StorageService');
        return;
      }

      // Delete file
      await file.delete();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log warning but don't throw - deletion failures shouldn't block other operations
      this.logger.warn(
        `Failed to delete file ${fileUrl}: ${errorMessage}`,
        'StorageService',
      );

      if (errorStack) {
        this.logger.debug(errorStack, 'StorageService');
      }
    }
  }

  /**
   * Delete all audio files for a speech
   * @param userId - User ID
   * @param speechId - Speech ID
   */
  async deleteAllSpeechFiles(userId: string, speechId: string): Promise<void> {
    try {
      const prefix = `users/${userId}/speeches/${speechId}/`;

      const bucket = this.storage.bucket(this.bucketName);

      // Get all files with the prefix
      const [files] = await bucket.getFiles({ prefix });

      if (files.length === 0) {
        this.logger.log(
          `No files found for speech: ${speechId}`,
          'StorageService',
        );
        return;
      }

      // Delete all files
      await Promise.all(files.map((file) => file.delete()));

      this.logger.log(
        `Deleted ${files.length} files for speech: ${speechId}`,
        'StorageService',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.warn(
        `Failed to delete speech files ${speechId}: ${errorMessage}`,
        'StorageService',
      );

      if (errorStack) {
        this.logger.debug(errorStack, 'StorageService');
      }
    }
  }

  /**
   * Extract file path from GCS public URL
   * @param url - Public URL or file path
   * @returns File path or null
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      // If it's already a path (doesn't start with http), return as is
      if (!url.startsWith('http')) {
        return url;
      }

      // Extract path from URL: https://storage.googleapis.com/{bucket}/{path}
      const urlPattern = new RegExp(
        `https://storage\\.googleapis\\.com/${this.bucketName}/(.+)`,
      );
      const match = url.match(urlPattern);

      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if file exists in GCS
   * @param filePath - File path in bucket
   * @returns True if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage client (for advanced operations)
   */
  getClient(): Storage {
    return this.storage;
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }
}
