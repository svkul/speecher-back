/**
 * Common exports for error handling
 * This file exports all error-related utilities for use across the application
 */

// Error codes and constants
export {
  ERROR_CODES,
  ERROR_SEVERITY,
  ERROR_STATUS_MAP,
  isErrorCode,
} from './error-codes.const';
export type { ErrorCode, ErrorSeverity } from './error-codes.const';

// Exception classes
export {
  AppException,
  ResourceNotFoundException,
  ValidationException,
  UnauthorizedException,
  TokenExpiredException,
  SessionExpiredException,
  ForbiddenException,
  DuplicateException,
  InvalidInputException,
  InvalidCodeException,
  BookingConflictException,
  InternalServerException,
  DatabaseException,
} from './app-exception';
export type { AppErrorExtensions, AppErrorResponse } from './app-exception';

// Error types and type guards
export type { RestApiErrorResponse } from './error-types';
export {
  isAppException,
  isAppErrorResponse,
  hasErrorCode,
  getErrorCode,
  getErrorField,
  getErrorMetadata,
  getErrorResponse,
  isAuthError,
  isValidationError,
  isNotFoundError,
  isConflictError,
  isServerError,
  getUserFriendlyMessage,
} from './error-types';
