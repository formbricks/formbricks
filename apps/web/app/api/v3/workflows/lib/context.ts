import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZSurveyEndings } from "@formbricks/types/surveys/types";
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
  verifyTriggerSurvey,
});
