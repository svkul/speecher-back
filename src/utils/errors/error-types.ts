import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from './error-codes.const';
import { AppException, AppErrorResponse } from './app-exception';

/**
 * REST API error response structure
 * Follows RFC 7807 Problem Details for HTTP APIs
 */
export interface RestApiErrorResponse extends AppErrorResponse {
  path?: string;
}

/**
 * Type guard to check if error is an AppException
 */
export function isAppException(error: unknown): error is AppException {
  return error instanceof AppException;
}

/**
 * Type guard to check if error is an HttpException with AppErrorResponse
 */
export function isAppErrorResponse(error: unknown): error is HttpException {
  if (!(error instanceof HttpException)) {
    return false;
  }
  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'statusCode' in response
  );
}

/**
 * Helper to safely get AppErrorResponse from HttpException
 */
function getAppErrorResponseFromHttpException(
  error: HttpException,
): AppErrorResponse | null {
  const response = error.getResponse();
  if (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'statusCode' in response
  ) {
    return response as AppErrorResponse;
  }
  return null;
}

/**
 * Type guard to check if error code matches specific code(s)
 */
export function hasErrorCode(error: unknown, ...codes: ErrorCode[]): boolean {
  if (isAppException(error)) {
    return codes.includes(error.code);
  }
  if (error instanceof HttpException) {
    const response = getAppErrorResponseFromHttpException(error);
    if (response) {
      return codes.includes(response.code);
    }
  }
  return false;
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (isAppException(error)) {
    return error.code;
  }
  if (error instanceof HttpException) {
    const response = getAppErrorResponseFromHttpException(error);
    if (response) {
      return response.code;
    }
  }
  return null;
}

/**
 * Extract error field from error
 */
export function getErrorField(error: unknown): string | null {
  if (isAppException(error)) {
    return error.field || null;
  }
  if (error instanceof HttpException) {
    const response = getAppErrorResponseFromHttpException(error);
    if (response) {
      return response.field || null;
    }
  }
  return null;
}

/**
 * Extract error metadata from error
 */
export function getErrorMetadata(
  error: unknown,
): Record<string, unknown> | null {
  if (isAppException(error)) {
    return error.metadata || null;
  }
  if (error instanceof HttpException) {
    const response = getAppErrorResponseFromHttpException(error);
    if (response) {
      return response.metadata || null;
    }
  }
  return null;
}

/**
 * Get full error response object
 */
export function getErrorResponse(error: unknown): AppErrorResponse | null {
  if (isAppException(error)) {
    return error.getResponse() as AppErrorResponse;
  }
  if (error instanceof HttpException) {
    return getAppErrorResponseFromHttpException(error);
  }
  return null;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  return hasErrorCode(
    error,
    ERROR_CODES.UNAUTHORIZED,
    ERROR_CODES.TOKEN_EXPIRED,
    ERROR_CODES.TOKEN_INVALID,
    ERROR_CODES.SESSION_EXPIRED,
  );
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: unknown): boolean {
  return hasErrorCode(
    error,
    ERROR_CODES.VALIDATION_ERROR,
    ERROR_CODES.INVALID_INPUT,
    ERROR_CODES.BAD_REQUEST,
  );
}

/**
 * Check if error is not found error
 */
export function isNotFoundError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (!code) return false;
  return code.endsWith('_NOT_FOUND') || code === ERROR_CODES.NOT_FOUND;
}

/**
 * Check if error is conflict/duplicate error
 */
export function isConflictError(error: unknown): boolean {
  return hasErrorCode(
    error,
    ERROR_CODES.DUPLICATE_ENTRY,
    ERROR_CODES.BUSINESS_ALREADY_EXISTS,
    ERROR_CODES.USER_ALREADY_EXISTS,
    ERROR_CODES.BOOKING_CONFLICT,
    ERROR_CODES.SLOT_NOT_AVAILABLE,
  );
}

/**
 * Check if error is server error
 */
export function isServerError(error: unknown): boolean {
  return hasErrorCode(
    error,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    ERROR_CODES.SERVICE_UNAVAILABLE,
  );
}

/**
 * Get user-friendly error message
 * Falls back to generic message if no specific message is available
 */
export function getUserFriendlyMessage(
  error: unknown,
  fallback: string = 'An error occurred',
): string {
  if (isAppException(error)) {
    return error.message || fallback;
  }
  if (error instanceof HttpException) {
    const response = getAppErrorResponseFromHttpException(error);
    if (response) {
      return response.message || fallback;
    }
    // Fallback to HttpException message if not AppErrorResponse
    const httpResponse = error.getResponse();
    if (typeof httpResponse === 'string') {
      return httpResponse;
    }
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
