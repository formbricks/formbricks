import "server-only";
import { logger } from "@formbricks/logger";
import { isAuthzedEnabled } from "./config";
import { AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";

export const AUTHZED_MAX_RECONCILIATION_PASSES = 3;

type TAuthzedProjectionErrorCode = TAuthzedErrorCode | "authzed_projection_unstable";

export type TAuthzedProjectionResult =
  | Readonly<{ status: "disabled" }>
  | Readonly<{ passes: number; status: "projected" }>
  | Readonly<{
      attempts: number;
      code: TAuthzedProjectionErrorCode;
      retryable: boolean;
      status: "failed";
    }>;

export class AuthzedProjectionUnstableError extends Error {
  readonly attempts = AUTHZED_MAX_RECONCILIATION_PASSES;
  readonly code = "authzed_projection_unstable";
  readonly retryable = false;
}

const getProjectionError = (
  error: unknown,
  operation: string
): Readonly<{
  attempts: number;
  code: TAuthzedProjectionErrorCode;
  retryable: boolean;
}> => {
  if (error instanceof AuthzedProjectionUnstableError) {
    return error;
  }

  const attempts = error instanceof AuthzedError ? error.attempts : 1;
  return mapAuthzedError(error, operation, attempts);
};

export const runBestEffortProjection = async (
  operation: string,
  projectionName: string,
  projection: () => Promise<number>
): Promise<TAuthzedProjectionResult> => {
  if (!isAuthzedEnabled()) {
    return { status: "disabled" };
  }

  const startedAt = performance.now();

  try {
    const passes = await projection();
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    logger.debug(
      {
        component: "authzed",
        durationMs,
        operation,
        passes,
        projection: projectionName,
        status: "projected",
      },
      "AuthZed relationship projection completed"
    );

    return { passes, status: "projected" };
  } catch (error) {
    const mappedError = getProjectionError(error, operation);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const result = {
      attempts: mappedError.attempts,
      code: mappedError.code,
      retryable: mappedError.retryable,
      status: "failed" as const,
    };

    logger.warn(
      {
        attempts: result.attempts,
        component: "authzed",
        durationMs,
        errorCode: result.code,
        operation,
        projection: projectionName,
        retryable: result.retryable,
      },
      "AuthZed relationship projection failed"
    );

    return result;
  }
};
