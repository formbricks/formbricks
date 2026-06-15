import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  type WorkflowApiContext,
  createWorkflowsHandlers,
  createWorkflowsService,
} from "@formbricks/workflows/server";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";

/**
 * Adapter glue between the Next.js v3 routes and the framework-agnostic `@formbricks/workflows`
 * handlers. The package owns business logic, validation, serialization, and error mapping; this
 * file injects the app's concrete `prisma`/`logger` and binds an `authorize` capability to the
 * authenticated request. The real Prisma client structurally satisfies the package's narrow
 * `WorkflowsDb` port, so no cast is needed; the package never imports `@formbricks/database`.
 */
const service = createWorkflowsService({ prisma });

/** Singleton handlers; they are stateless and only close over the injected service. */
export const workflowsHandlers = createWorkflowsHandlers(service);

const getUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication && authentication.user?.id ? authentication.user.id : null;

export const buildWorkflowApiContext = (
  authentication: TV3Authentication,
  requestId: string,
  instance: string
): WorkflowApiContext => ({
  userId: getUserId(authentication),
  requestId,
  instance,
  logger: logger.withContext({ requestId }),
  authorize: (workspaceId, access) =>
    requireV3WorkspaceAccess(authentication, workspaceId, access, requestId, instance),
});
