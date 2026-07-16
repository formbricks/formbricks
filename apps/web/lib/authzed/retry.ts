import "server-only";
import { randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { logger } from "@formbricks/logger";
import { AUTHZED_MAX_ATTEMPTS, AUTHZED_RETRY_BASE_DELAYS_MS, AUTHZED_RETRY_JITTER_RATIO } from "./constants";
import { mapAuthzedError } from "./errors";

type TAuthzedRetryDependencies = Readonly<{
  now: () => number;
  random: () => number;
  sleep: (delayMs: number) => Promise<void>;
}>;

const AUTHZED_RETRY_RANDOM_SCALE = 1_000_000;

const defaultDependencies: TAuthzedRetryDependencies = {
  now: () => performance.now(),
  random: () => randomInt(AUTHZED_RETRY_RANDOM_SCALE + 1) / AUTHZED_RETRY_RANDOM_SCALE,
  sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
};

export const calculateAuthzedRetryDelayMs = (retryIndex: number, randomValue: number): number => {
  const baseDelayMs = AUTHZED_RETRY_BASE_DELAYS_MS[retryIndex];

  if (baseDelayMs === undefined) {
    throw new RangeError(`Unsupported AuthZed retry index: ${retryIndex}`);
  }

  const boundedRandomValue = Math.min(1, Math.max(0, randomValue));
  const jitterMultiplier =
    1 - AUTHZED_RETRY_JITTER_RATIO + boundedRandomValue * AUTHZED_RETRY_JITTER_RATIO * 2;

  return Math.round(baseDelayMs * jitterMultiplier);
};

export const executeAuthzedOperation = async <T>(
  operation: string,
  request: () => Promise<T>,
  dependencyOverrides: Partial<TAuthzedRetryDependencies> = {}
): Promise<T> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const startedAt = dependencies.now();

  for (let attempt = 1; attempt <= AUTHZED_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const authzedError = mapAuthzedError(error, operation, attempt);
      const durationMs = Math.max(0, Math.round(dependencies.now() - startedAt));
      const shouldRetry = authzedError.retryable && attempt < AUTHZED_MAX_ATTEMPTS;

      if (!shouldRetry) {
        logger.warn(
          {
            attemptCount: attempt,
            component: "authzed",
            durationMs,
            errorCode: authzedError.code,
            grpcStatus: authzedError.grpcStatus,
            operation,
            retryable: authzedError.retryable,
          },
          "AuthZed request failed"
        );
        throw authzedError;
      }

      const retryDelayMs = calculateAuthzedRetryDelayMs(attempt - 1, dependencies.random());
      logger.debug(
        {
          attemptCount: attempt,
          component: "authzed",
          durationMs,
          errorCode: authzedError.code,
          grpcStatus: authzedError.grpcStatus,
          operation,
          retryable: authzedError.retryable,
          retryDelayMs,
        },
        "AuthZed request retry scheduled"
      );
      await dependencies.sleep(retryDelayMs);
    }
  }

  throw new Error("AuthZed retry loop exited unexpectedly");
};
