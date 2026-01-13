import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  constructor(private configService: ConfigService) {
    // Prisma 7 requires either adapter or accelerateUrl
    // Using @prisma/adapter-pg for PostgreSQL connection
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
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error: unknown) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
