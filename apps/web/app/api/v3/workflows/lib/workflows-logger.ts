import type { WorkflowApiContext } from "@formbricks/workflows/server";
import { loggableError } from "@/lib/utils/loggable-error";

type TWorkflowsLogger = WorkflowApiContext["logger"];

/** The keys the package logs a caught error under. */
const ERROR_KEYS = ["error", "err"] as const;

/**
 * The logger `@formbricks/workflows` writes through. The package cannot import the app's
 * `loggableError`, so its log calls pass the caught error as `error` or `err`, and this adapter turns
 * it into name and frames: an error's message can quote a definition, a payload or a Prisma value.
 */
export const toWorkflowsLogger = (log: TWorkflowsLogger): TWorkflowsLogger => {
  const scrub = (fields: object): object => {
    if (!ERROR_KEYS.some((key) => key in fields)) return fields;
    const rest: Record<string, unknown> = { ...fields };
    let loggable = {};
    for (const key of ERROR_KEYS) {
      if (!(key in rest)) continue;
      loggable = { ...loggable, ...loggableError(rest[key]) };
      delete rest[key];
    }
    return { ...rest, ...loggable };
  };
  return {
    warn: (fields, message) => log.warn(scrub(fields), message),
    error: (fields, message) => log.error(scrub(fields), message),
  };
};
