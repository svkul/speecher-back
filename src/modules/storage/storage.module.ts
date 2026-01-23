import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LoggerModule } from '../logger/logger.module';

/**
 * Module for file storage management (Google Cloud Storage)
 */
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
