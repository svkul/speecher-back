import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from '../logger/logger.module';
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
    LoggerModule, // LoggerModule is global, but importing here ensures it's initialized
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
