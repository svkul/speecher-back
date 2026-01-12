import { ConsoleLogger, Injectable } from '@nestjs/common';
import { LogLevel } from './logger.module';

/**
 * Options for configuring FilteredLogger behavior.
 */
interface FilteredLoggerOptions {
  /** List of contexts to allow. If empty, all contexts are allowed. */
  allowContexts?: string[];
  /** List of contexts to deny. Takes precedence over allowContexts. */
  denyContexts?: string[];
  /** List of log levels to enable. If not provided, all levels are enabled. */
  logLevels?: LogLevel[];
}

/**
 * Console logger with allow/deny filtering by context.
 * Contexts correspond to the string passed to `new Logger('Context')`.
 *
 * Filtering logic:
 * 1. If context is in denyContexts -> log is blocked
 * 2. If allowContexts is empty -> all contexts are allowed (except denied)
 * 3. If allowContexts is non-empty -> only listed contexts are allowed
 */
@Injectable()
export class FilteredLogger extends ConsoleLogger {
  private readonly allowedContexts: Set<string>;
  private readonly deniedContexts: Set<string>;

  constructor(options?: FilteredLoggerOptions) {
    super();

    this.allowedContexts = new Set(options?.allowContexts ?? []);
    this.deniedContexts = new Set(options?.denyContexts ?? []);

    // Set log levels if provided (NestJS ConsoleLogger accepts our LogLevel type)
    if (options?.logLevels?.length) {
      this.setLogLevels(options.logLevels);
    }
  }

  log(message: unknown, context?: string): void {
    if (!this.isContextAllowed(context)) return;
    super.log(message, context);
  }

  warn(message: unknown, context?: string): void {
    if (!this.isContextAllowed(context)) return;
    super.warn(message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    if (!this.isContextAllowed(context)) return;
    super.error(message, trace, context);
  }

  debug(message: unknown, context?: string): void {
    if (!this.isContextAllowed(context)) return;
    super.debug(message, context);
  }

  verbose(message: unknown, context?: string): void {
    if (!this.isContextAllowed(context)) return;
    super.verbose(message, context);
  }

  /**
   * Checks if a context is allowed for logging.
   * Evaluation order:
   * 1. Check if context is denied (highest priority)
   * 2. If no allowlist is set, allow all contexts
   * 3. If allowlist exists, check if context is in it
   *
   * @param context - Optional context string to check
   * @returns true if context is allowed, false otherwise
   */
  private isContextAllowed(context?: string): boolean {
    if (context && this.deniedContexts.has(context)) {
      return false;
    }

    // If no allowlist is configured, allow all (except denied)
    if (this.allowedContexts.size === 0) {
      return true;
    }

    // If allowlist exists, context must be in it
    return context !== undefined && this.allowedContexts.has(context);
  }
}
