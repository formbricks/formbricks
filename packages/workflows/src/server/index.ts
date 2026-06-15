/**
 * Server entry point for `@formbricks/workflows/server`. Everything here is server-only (it talks
 * to an injected Prisma client and builds HTTP responses) and is deliberately kept out of the
 * browser-safe `.` entry, which exposes only contracts and types. The `apps/web` Next.js routes
 * import from here, inject `prisma`/`logger`/`authorize`, and delegate.
 */

export { createWorkflowsService } from "../services/workflows.service";
export type { WorkflowsService, WorkflowListPage } from "../services/workflows.service";

export { createWorkflowsHandlers } from "../handlers/workflows.handlers";
export type { WorkflowsHandlers } from "../handlers/workflows.handlers";

export { toWorkflowListItem, toWorkflowResource, toWorkflowRunSummary } from "../handlers/serializers";

export type { WorkflowApiAccess, WorkflowApiContext, AuthorizedWorkspace } from "../handlers/context";

export type {
  WorkflowsDb,
  WorkflowsLogger,
  WorkflowRow,
  WorkflowRunRow,
  WorkflowRowWithLastRun,
} from "../services/ports";

export {
  WorkflowApiError,
  WorkflowConflictError,
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  WorkflowSerializationError,
  toProblemResponse,
} from "../errors";
export type { WorkflowInvalidParam, WorkflowProblemCode } from "../errors";
