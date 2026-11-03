import { CacheErrorClass, ErrorCode } from "./types/error";

export const REDIS_OPERATION_TIMEOUT_MS = 500;
export const REDIS_CONNECT_TIMEOUT_MS = 750;

/** A deadline for promises that have their own cancellation or cleanup path. */
export const withRedisDeadline = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          try {
            onTimeout();
          } catch {
            // Cleanup cannot leave callers waiting past the deadline.
          }
          reject(new CacheErrorClass(ErrorCode.RedisOperationError, "Redis operation timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
