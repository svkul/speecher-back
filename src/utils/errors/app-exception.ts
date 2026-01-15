import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ERROR_CODES,
  ERROR_STATUS_MAP,
  ErrorCode,
  ErrorSeverity,
} from './error-codes.const';

/**
 * Application error response structure
 * Follows RFC 7807 Problem Details for HTTP APIs
 */
export interface AppErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  timestamp: string;
  path?: string;
  reason?: string;
  field?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * Application error extensions
 * Additional error metadata that can be attached to exceptions
 */
export interface AppErrorExtensions {
  code: ErrorCode;
  reason?: string;
  field?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * Base application exception
 * All custom exceptions should extend this class
 * Extends NestJS HttpException for REST API compatibility
 */
export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly timestamp: string;
  public readonly severity?: ErrorSeverity;
  public readonly field?: string;
  public readonly reason?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    additionalExtensions?: Partial<Omit<AppErrorExtensions, 'code'>>,
  ) {
    const statusCode =
      ERROR_STATUS_MAP[code] || HttpStatus.INTERNAL_SERVER_ERROR;
    const timestamp = new Date().toISOString();

    const response: AppErrorResponse = {
      statusCode,
      code,
      message,
      timestamp,
      ...(additionalExtensions?.reason && {
        reason: additionalExtensions.reason,
      }),
      ...(additionalExtensions?.field && { field: additionalExtensions.field }),
      ...(additionalExtensions?.severity && {
        severity: additionalExtensions.severity,
      }),
      ...(additionalExtensions?.metadata && {
        metadata: additionalExtensions.metadata,
      }),
    };

    super(response, statusCode);

    // Store properties for direct access
    this.code = code;
    this.timestamp = timestamp;
    this.severity = additionalExtensions?.severity;
    this.field = additionalExtensions?.field;
    this.reason = additionalExtensions?.reason;
    this.metadata = additionalExtensions?.metadata;
  }
}

/**
 * Resource not found exception
 * Automatically maps resource type to specific error code
 */
export class ResourceNotFoundException extends AppException {
  constructor(resource: string, id?: string) {
    const resourceCodeMap = {
      Business: ERROR_CODES.BUSINESS_NOT_FOUND,
      Calendar: ERROR_CODES.CALENDAR_NOT_FOUND,
      CalendarEntry: ERROR_CODES.CALENDAR_ENTRY_NOT_FOUND,
      Booking: ERROR_CODES.BOOKING_NOT_FOUND,
      User: ERROR_CODES.USER_NOT_FOUND,
    } as const;

    const code =
      resourceCodeMap[resource as keyof typeof resourceCodeMap] ||
      ERROR_CODES.NOT_FOUND;

    super(`${resource} not found${id ? ` with id: ${id}` : ''}`, code, {
      metadata: { resource, id },
    });
  }
}

/**
 * Validation exception
 * Used for input validation errors
 */
export class ValidationException extends AppException {
  constructor(message: string, field?: string) {
    super(message, ERROR_CODES.VALIDATION_ERROR, { field });
  }
}

/**
 * Unauthorized exception
 * Used when user is not authenticated
 */
export class UnauthorizedException extends AppException {
  constructor(message: string = 'Unauthorized', reason?: string) {
    super(message, ERROR_CODES.UNAUTHORIZED, { reason });
  }
}

/**
 * Token expired exception
 * Used when JWT token has expired
 */
export class TokenExpiredException extends AppException {
  constructor(
    message: string = 'Token expired',
    tokenType?: 'access' | 'refresh',
  ) {
    super(message, ERROR_CODES.TOKEN_EXPIRED, {
      reason: tokenType ? `${tokenType} token expired` : undefined,
    });
  }
}

/**
 * Session expired exception
 * Used when user session has expired
 */
export class SessionExpiredException extends AppException {
  constructor(message: string = 'Session expired') {
    super(message, ERROR_CODES.SESSION_EXPIRED);
  }
}

/**
 * Forbidden exception
 * Used when user doesn't have permission
 */
export class ForbiddenException extends AppException {
  constructor(message: string = 'Access denied', reason?: string) {
    super(message, ERROR_CODES.FORBIDDEN, { reason });
  }
}

/**
 * Duplicate entry exception
 * Used when trying to create a resource that already exists
 */
export class DuplicateException extends AppException {
  constructor(resource: string, field?: string, value?: string) {
    const resourceCodeMap = {
      Business: ERROR_CODES.BUSINESS_ALREADY_EXISTS,
      User: ERROR_CODES.USER_ALREADY_EXISTS,
    } as const;

    const code =
      resourceCodeMap[resource as keyof typeof resourceCodeMap] ||
      ERROR_CODES.DUPLICATE_ENTRY;

    super(`${resource} already exists${field ? ` with ${field}` : ''}`, code, {
      field,
      metadata: { resource, value },
    });
  }
}

/**
 * Invalid input exception
 * Used for general input validation errors
 */
export class InvalidInputException extends AppException {
  constructor(message: string, field?: string) {
    super(message, ERROR_CODES.INVALID_INPUT, { field });
  }
}

/**
 * Invalid code exception
 * Used for verification/reset codes
 */
export class InvalidCodeException extends AppException {
  constructor(message: string = 'Invalid or expired code') {
    super(message, ERROR_CODES.INVALID_CODE);
  }
}

/**
 * Booking conflict exception
 * Used when booking time slot is not available
 */
export class BookingConflictException extends AppException {
  constructor(message: string = 'Booking time slot is not available') {
    super(message, ERROR_CODES.BOOKING_CONFLICT);
  }
}

/**
 * Internal server error exception
 * Used for unexpected server errors
 */
export class InternalServerException extends AppException {
  constructor(
    message: string = 'Internal server error',
    metadata?: Record<string, unknown>,
  ) {
    super(message, ERROR_CODES.INTERNAL_SERVER_ERROR, {
      severity: 'CRITICAL',
      metadata,
    });
  }
}

/**
 * Database error exception
 * Used for database-related errors
 */
export class DatabaseException extends AppException {
  constructor(
    message: string = 'Database error occurred',
    metadata?: Record<string, unknown>,
  ) {
    super(message, ERROR_CODES.DATABASE_ERROR, {
      severity: 'HIGH',
      metadata,
    });
  }
}
