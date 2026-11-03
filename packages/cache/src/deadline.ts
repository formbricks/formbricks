import { CacheErrorClass, ErrorCode } from "./types/error";

export const REDIS_OPERATION_TIMEOUT_MS = 500;
export const REDIS_CONNECT_TIMEOUT_MS = 750;
/** Give late replies two more deadline periods before discarding the shared socket. */
export const REDIS_OPERATION_CLEANUP_DELAY_MS = REDIS_OPERATION_TIMEOUT_MS * 2;

/** A deadline for promises that have their own cancellation or cleanup path. */
export const withRedisDeadline = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
  cleanupDelayMs = 0
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  if (cleanupDelayMs > 0) {
    const clearCleanup = () => {
      settled = true;
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
    void Promise.resolve(operation).then(clearCleanup, clearCleanup);
  }

  const cleanup = () => {
    try {
      onTimeout();
    } catch {
      // Cleanup cannot leave callers waiting past the deadline.
    }
  };

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          if (settled) return;
          if (cleanupDelayMs > 0) {
            cleanupTimer = setTimeout(cleanup, cleanupDelayMs);
          } else {
            cleanup();
          }
          reject(new CacheErrorClass(ErrorCode.RedisOperationError, "Redis operation timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
