import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  BeforeApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(private configService: ConfigService) {
    // Using @prisma/adapter-pg for PostgreSQL connection pooling
    // Using ConfigService instead of process.env for better NestJS integration
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
    const pool = new Pool({
      connectionString: databaseUrl,
    });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['warn', 'error'], // ['query', 'info', 'warn', 'error']
    });

    // Store pool reference for cleanup
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to connect to database: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error instanceof Error
        ? error
        : new Error('Failed to connect to database');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    try {
      await this.$disconnect();
      await this.pool.end();
      this.logger.log('Database connections closed successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error during database cleanup: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error instanceof Error
        ? error
        : new Error('Error during database cleanup');
    }
  }
}
