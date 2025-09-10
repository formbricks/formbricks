// Result type system for cache operations
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

// Utility functions for creating Result objects
export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });
export const err = <E = Error>(error: E): Result<never, E> => ({ ok: false, error });

// Error codes for cache operations
export enum ErrorCode {
  Unknown = "unknown",
  CacheValidationError = "cache_validation_error",
  RedisConnectionError = "redis_connection_error",
  RedisOperationError = "redis_operation_error",
  CacheCorruptionError = "cache_corruption_error",
  RedisConfigurationError = "redis_configuration_error",
}

// Generic error type for all cache operations
export interface CacheError {
  code: ErrorCode;
}

// CacheError class that extends Error for proper error handling
export class CacheErrorClass extends Error implements CacheError {
  constructor(
    public code: ErrorCode,
    message?: string
  ) {
    super(message ?? `Cache error: ${code}`);
    this.name = "CacheError";

    // Maintains proper prototype chain in older environments
    Object.setPrototypeOf(this, CacheErrorClass.prototype);
  }

  /**
   * Creates a CacheErrorClass from a plain CacheError object
   * Useful for converting existing error objects to proper Error instances
   */
  static fromCacheError(error: CacheError, message?: string): CacheErrorClass {
    return new CacheErrorClass(error.code, message);
  }
}
