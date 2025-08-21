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
}

// Generic error type for all cache operations
export interface CacheError {
  code: ErrorCode;
}
