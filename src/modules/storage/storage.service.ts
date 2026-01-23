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
        this.logger.log(
          'Storage client initialized with key file',
          'StorageService',
        );
      } else if (credentials) {
        const parsedCredentials = JSON.parse(credentials) as {
          project_id?: string;
          [key: string]: unknown;
        };
        this.storage = new Storage({
          credentials: parsedCredentials,
          projectId: projectId || parsedCredentials.project_id,
        });
        this.logger.log(
          'Storage client initialized with JSON credentials',
          'StorageService',
        );
      } else {
        // Use Application Default Credentials
        this.storage = new Storage({ projectId });
        this.logger.log(
          'Storage client initialized with ADC',
          'StorageService',
        );
      }

      // Verify bucket exists
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();

      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }

      this.logger.log(
        `Storage initialized with bucket: ${this.bucketName}`,
        'StorageService',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to initialize Storage: ${errorMessage}`,
        errorStack,
        'StorageService',
      );

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
    try {
      // Generate file path: users/{userId}/speeches/{speechId}/{blockId}-{timestamp}.mp3
      const timestamp = Date.now();
      const fileName = `${blockId}-${timestamp}.mp3`;
      const filePath = `users/${userId}/speeches/${speechId}/${fileName}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      // Upload file with metadata
      await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
        public: true, // Make file publicly accessible
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
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to upload file: ${errorMessage}`,
        errorStack,
        'StorageService',
      );

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
        this.logger.warn(
          `Could not extract file path from URL: ${fileUrl}`,
          'StorageService',
        );
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

      this.logger.log(
        `File deleted successfully: ${filePath}`,
        'StorageService',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log warning but don't throw - deletion failures shouldn't block other operations
      this.logger.warn(
        `Failed to delete file ${fileUrl}: ${errorMessage}`,
        'StorageService',
      );
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
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        `Failed to delete speech files ${speechId}: ${errorMessage}`,
        'StorageService',
      );
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
