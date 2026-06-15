/**
 * Server entry point for `@formbricks/workflows/server`. Everything here is server-only (it talks
 * to an injected Prisma client and builds HTTP responses) and is deliberately kept out of the
 * browser-safe `.` entry, which exposes only contracts and types. The `apps/web` Next.js routes
 * import from here, inject `prisma`/`logger`/`authorize`, and delegate.
 *
 * The surface is intentionally minimal: the factories + context the adapter consumes, plus the
 * typed domain errors and problem mapper that ENG-1222/1223 reuse. Serializers, ports, and row
 * types stay internal (imported within the package via relative paths).
 */

export { createWorkflowsService } from "../services/workflows.service";
export type { WorkflowsService } from "../services/workflows.service";

export { createWorkflowsHandlers } from "../handlers/workflows.handlers";
export type { WorkflowsHandlers } from "../handlers/workflows.handlers";

export type { WorkflowApiAccess, WorkflowApiContext, AuthorizedWorkspace } from "../handlers/context";

export {
  WorkflowApiError,
  WorkflowConflictError,
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  WorkflowSerializationError,
  toProblemResponse,
} from "../errors";
export type { WorkflowInvalidParam, WorkflowProblemCode } from "../errors";
