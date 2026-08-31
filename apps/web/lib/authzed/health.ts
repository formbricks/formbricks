import "server-only";
import { performance } from "node:perf_hooks";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";

export type TAuthzedHealthResult =
  | Readonly<{ status: "disabled" }>
  | Readonly<{ latencyMs: number; status: "healthy" }>
  | Readonly<{
      code: TAuthzedErrorCode;
      latencyMs: number;
      retryable: boolean;
      status: "unhealthy";
    }>;

const getLatencyMs = (startedAt: number): number => Math.max(0, Math.round(performance.now() - startedAt));

export const checkAuthzedHealth = async (): Promise<TAuthzedHealthResult> => {
  if (!isAuthzedEnabled()) {
    return { status: "disabled" };
  }

  const startedAt = performance.now();

  try {
    await getAuthzedClient().readSchema();
    return { latencyMs: getLatencyMs(startedAt), status: "healthy" };
  } catch (error) {
    const authzedError = error instanceof AuthzedError ? error : mapAuthzedError(error, "health_check", 1);

    return {
      code: authzedError.code,
      latencyMs: getLatencyMs(startedAt),
      retryable: authzedError.retryable,
      status: "unhealthy",
    };
  }
};
