import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthzedProjectionResult } from "./projection";

export const runPostCommitProjection = async (
  operation: string,
  projection: () => Promise<TAuthzedProjectionResult>
): Promise<void> => {
  try {
    await projection();
  } catch {
    logger.error(
      {
        code: "authzed_internal",
        component: "authzed",
        operation,
      },
      "Unexpected AuthZed projection failure after source commit"
    );
  }
};
