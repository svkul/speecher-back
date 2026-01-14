import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './modules/app/app.module';
import { FilteredLogger } from './modules/logger/filtered-logger.service';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true, // Buffer logs until logger is set
    });

    // Get FilteredLogger instance and set it as global logger
    const logger = app.get(FilteredLogger);
    app.useLogger(logger);

    // Enable validation pipe for DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties that don't have decorators
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
        transform: true, // Automatically transform payloads to DTO instances
        transformOptions: {
          enableImplicitConversion: true, // Enable implicit type conversion
        },
      }),
    );

    const configService = app.get(ConfigService);
    const PORT = configService.getOrThrow<string>('PORT');
    const NODE_ENV = configService.getOrThrow<string>('NODE_ENV');

    logger.log(`Listening on port ${PORT} (env: ${NODE_ENV})`, 'Bootstrap');

    await app.listen(Number(PORT));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
