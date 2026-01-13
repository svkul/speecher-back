import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilteredLogger } from './filtered-logger.service';

/**
 * Available log levels matching NestJS Logger levels.
 */
export const LOGGER_LEVELS = {
  LOG: 'log',
  ERROR: 'error',
  WARN: 'warn',
  DEBUG: 'debug',
  VERBOSE: 'verbose',
} as const;

/**
 * Type representing valid log levels.
 */
export type LogLevel = (typeof LOGGER_LEVELS)[keyof typeof LOGGER_LEVELS];

/**
 * Set of valid log levels for O(1) lookup performance.
 */
const VALID_LOG_LEVELS = new Set(Object.values(LOGGER_LEVELS));

/**
 * Parses a comma-separated string into an array of trimmed non-empty strings.
 * @param value - Comma-separated string to parse
 * @returns Array of trimmed strings, empty array if value is undefined or empty
 */
const parseList = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Parses a comma-separated string of log levels and validates them.
 * Invalid levels are filtered out.
 * @param value - Comma-separated string of log levels
 * @returns Array of valid log levels
 */
const parseLogLevels = (value?: string): LogLevel[] =>
  parseList(value).filter((level): level is LogLevel =>
    VALID_LOG_LEVELS.has(level as LogLevel),
  );

/**
 * Global logger module that provides FilteredLogger instance for the entire application.
 * No need to import this module in other modules - it's available globally.
 */
@Global()
@Module({
  providers: [
    {
      provide: FilteredLogger,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const allowContexts = parseList(
          configService.get<string>('LOG_CONTEXTS_ALLOW'),
        );
        const denyContexts = parseList(
          configService.get<string>('LOG_CONTEXTS_DENY'),
        );
        const logLevels = parseLogLevels(
          configService.get<string>('LOG_LEVELS'),
        );

        return new FilteredLogger({
          allowContexts: allowContexts.length ? allowContexts : undefined,
          denyContexts: denyContexts.length ? denyContexts : undefined,
          logLevels: logLevels.length ? logLevels : undefined,
        });
      },
    },
  ],
  exports: [FilteredLogger],
})
export class LoggerModule {}
