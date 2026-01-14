import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { configSchema, configValidationSchema } from '../../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configSchema],
      isGlobal: true,
      expandVariables: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    LoggerModule,
    PrismaModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
