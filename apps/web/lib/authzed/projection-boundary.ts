import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthzedProjectionResult } from "./projection";

export const runPostCommitProjection = async (
  operation: string,
  projection: () => Promise<TAuthzedProjectionResult>
): Promise<void> => {
  try {
    await projection();
  } catch (error) {
    logger.error(
      {
        component: "authzed",
        // `errorCode`, matching every other AuthZed failure log. This previously used `code`, so a
        // single query could not cover both this path and the projection failures below it — and this
        // is the path that fires when a projector itself has a bug, which is the one you least want to
        // miss.
        errorCode: "authzed_internal",
        errorName: error instanceof Error ? error.name : "NonError",
        operation,
        retryable: false,
        status: "failed",
      },
      "Unexpected AuthZed projection failure after source commit"
    );
  }
};
