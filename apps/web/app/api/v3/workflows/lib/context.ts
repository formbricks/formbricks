import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZSurveyEndings } from "@formbricks/types/surveys/types";
import {
  type WorkflowApiContext,
  type WorkflowAuditDetail,
  createWorkflowsHandlers,
  createWorkflowsService,
} from "@formbricks/workflows/server";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";

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

/**
 * Confirm a workflow trigger's referenced survey + ending cards exist in the workspace. Injected so
 * `@formbricks/workflows` stays survey-agnostic. Scoped by the survey's `(id, workspaceId)` composite
 * key; ending ids come from the survey's `endings`, parsed through `ZSurveyEndings` so the JSON
 * column is validated (not accessed untyped) before reading ids.
 */
const verifyTriggerSurvey: WorkflowApiContext["verifyTriggerSurvey"] = async ({
  workspaceId,
  surveyId,
  endingCardIds,
}) => {
  const survey = await prisma.survey.findUnique({
    where: { id_workspaceId: { id: surveyId, workspaceId } },
    select: { endings: true },
  });

  if (!survey) {
    return { surveyExists: false, missingEndingCardIds: [] };
  }

  const endingIds = new Set(ZSurveyEndings.parse(survey.endings).map((ending) => ending.id));
  return {
    surveyExists: true,
    missingEndingCardIds: endingCardIds.filter((endingCardId) => !endingIds.has(endingCardId)),
  };
};

/** Reads the workspace id off an audit snapshot (the serialized resource carries it as a string). */
const getWorkspaceId = (detail: WorkflowAuditDetail): string | undefined => {
  const source = detail.newObject ?? detail.oldObject;
  const workspaceId = source?.workspaceId;
  return typeof workspaceId === "string" ? workspaceId : undefined;
};

/**
 * Bind the framework-agnostic audit sink to this request's audit log. The handlers call it once,
 * post-mutation, with the affected workflow id + before/after snapshots; we copy those onto
 * `auditLog` (target id, old/new object) so the v3 wrapper queues a complete Enterprise event.
 *
 * Organization resolution: the API-key path already set `auditLog.organizationId` from the key's
 * org (see `buildV3AuditLog`); the session path leaves it as `UNKNOWN_DATA`, so we resolve the
 * workflow's real org from its workspace here. Any failure is swallowed and logged — an audit
 * problem must never break or alter an already-successful mutation.
 */
const buildRecordAudit =
  (
    auditLog: TV3AuditLog,
    authentication: TV3Authentication,
    requestId: string
  ): NonNullable<WorkflowApiContext["recordAudit"]> =>
  async (detail) => {
    try {
      auditLog.targetId = detail.targetId;
      auditLog.oldObject = detail.oldObject;
      auditLog.newObject = detail.newObject;

      // API-key auth already carries the org; only the session path needs resolution.
      const isApiKey = !!authentication && "apiKeyId" in authentication;
      if (!isApiKey) {
        const workspaceId = getWorkspaceId(detail);
        if (workspaceId) {
          auditLog.organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
        }
      }
    } catch (error) {
      logger.withContext({ requestId }).error({ error }, "Failed to record workflow audit detail");
    }
  };

export const buildWorkflowApiContext = (
  authentication: TV3Authentication,
  requestId: string,
  instance: string,
  auditLog?: TV3AuditLog
): WorkflowApiContext => ({
  userId: getUserId(authentication),
  requestId,
  instance,
  logger: logger.withContext({ requestId }),
  authorize: (workspaceId, access) =>
    requireV3WorkspaceAccess(authentication, workspaceId, access, requestId, instance),
  verifyTriggerSurvey,
  ...(auditLog ? { recordAudit: buildRecordAudit(auditLog, authentication, requestId) } : {}),
});
