/**
 * Utility functions for safe logging
 * Prevents sensitive information leakage in logs
 */

import { Prisma } from '../../generated/prisma/client';

/**
 * Safely convert Prisma JsonValue to Record<string, any>
 * Returns null if the value is not an object
 */
export function jsonValueToObject(
  value: Prisma.JsonValue | null | undefined,
): Record<string, any> | null {
  if (!value) {
    return null;
  }

  // Check if it's already an object (not array, not primitive)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return null;
}

/**
 * Sanitize user identifier for logging
 * Replaces full ID with partial ID (first 8 chars) for privacy
 */
export function sanitizeUserId(userId: string | undefined | null): string {
  if (!userId) {
    return 'anonymous';
  }
  // Show only first 8 characters for identification without full exposure
  return userId.length > 8 ? `${userId.substring(0, 8)}...` : userId;
}

/**
 * Sanitize email for logging
 * Replaces email with masked version (e.g., u***@example.com)
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) {
    return 'no-email';
  }

  const [localPart, domain] = email.split('@');
  if (!domain) {
    return 'invalid-email';
  }

  // Mask local part: show first char and last char if length > 2
  const maskedLocal =
    localPart.length > 2
      ? `${localPart[0]}***${localPart[localPart.length - 1]}`
      : localPart.length > 1
        ? `${localPart[0]}***`
        : '***';

  return `${maskedLocal}@${domain}`;
}

/**
 * Remove sensitive fields from object for logging
 */
export function sanitizeObjectForLogging<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'key', 'apiKey'],
): Partial<T> {
  const sanitized = { ...obj } as Record<string, unknown>;

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized as Partial<T>;
}

/**
 * Sanitize push token for logging
 * Shows only first 8 and last 4 characters for identification
 */
export function sanitizePushToken(token: string | undefined | null): string {
  if (!token) {
    return '[NO-TOKEN]';
  }

  if (token.length < 12) {
    return '[INVALID-TOKEN]';
  }

  // Show first 8 and last 4 characters
  return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
}

/**
 * Create safe error message that doesn't expose internal details
 */
export function createSafeErrorMessage(
  error: unknown,
  defaultMessage = 'An error occurred',
): string {
  if (error instanceof Error) {
    // In production, don't expose error messages that might contain sensitive info
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Return generic message in production
      return defaultMessage;
    }

    // In development, return actual message
    return error.message;
  }

  return defaultMessage;
}
