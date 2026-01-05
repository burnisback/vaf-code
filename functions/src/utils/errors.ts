/**
 * Custom Error Classes for API responses
 */

import { HttpsError } from 'firebase-functions/v2/https';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }

  toHttpsError(): HttpsError {
    const codeMap: Record<number, 'invalid-argument' | 'not-found' | 'permission-denied' |
      'unauthenticated' | 'resource-exhausted' | 'internal'> = {
        400: 'invalid-argument',
        401: 'unauthenticated',
        403: 'permission-denied',
        404: 'not-found',
        429: 'resource-exhausted',
        500: 'internal',
      };
    return new HttpsError(codeMap[this.statusCode] || 'internal', this.message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string) {
    super('QUOTA_EXCEEDED', `${resource} quota exceeded`, 429);
    this.name = 'QuotaExceededError';
  }
}

export function handleError(error: unknown): HttpsError {
  if (error instanceof AppError) {
    return error.toHttpsError();
  }

  if (error instanceof HttpsError) {
    return error;
  }

  console.error('Unhandled error:', error);
  return new HttpsError('internal', 'An unexpected error occurred');
}
