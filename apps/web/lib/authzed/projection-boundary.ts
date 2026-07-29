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
        code: "authzed_internal",
        component: "authzed",
        errorName: error instanceof Error ? error.name : "NonError",
        operation,
      },
      "Unexpected AuthZed projection failure after source commit"
    );
  }
};
