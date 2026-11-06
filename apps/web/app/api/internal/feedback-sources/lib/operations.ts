import "server-only";
import { prisma } from "@formbricks/database";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { assertCan } from "@/lib/authorization";
import { assertFeedbackSourceDirectoryAccess } from "@/lib/feedback-source/access";
import { importHistoricalResponses } from "@/lib/feedback-source/import";
import { resolveFormbricksMappingsInput } from "@/lib/feedback-source/mappings";
import {
  type TMappingsInput,
  createFeedbackSourceWithMappings,
  deleteFeedbackSource,
  getFeedbackSourceScope,
  getFeedbackSourceWithMappingsById,
  updateFeedbackSourceWithMappings,
} from "@/lib/feedback-source/service";
import {
  formatMissingRequiredCsvFieldMappingsMessage,
  getMissingRequiredCsvFieldMappings,
  sanitizeCsvFieldMappings,
} from "@/lib/feedback-source/utils";
import { getSurvey } from "@/lib/survey/service";
import {
  SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE,
  assertNewlyAttachedSurveysWorkspaceVisible,
} from "@/lib/survey/visibility/outbound";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type {
  TFeedbackSourceCreateBody,
  TFeedbackSourceImportBody,
  TFeedbackSourceImportResource,
  TFeedbackSourceUpdateBody,
  TFeedbackSourceWriteResource,
} from "../schemas";

/**
 * Feedback sources: where a workspace's feedback comes from, and how it maps onto a feedback dataset.
 *
 * Every source is reached through its own row — the workspace it is authorized against is the one it
 * lives in, never one the caller names — and through the dataset it writes to
 * (`feedbackDirectoryAssignment.*`), so a workspace member can't feed another team's dataset.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

const FORBIDDEN = "You are not authorized to access this resource";

/** The service's codes for a clash with what is stored; its other refusals are the input's fault. */
const SOURCE_CONFLICT_CODES = new Set([
  "FEEDBACK_SOURCE_NAME_DUPLICATE",
  "FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE",
  "FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE",
]);

/**
 * Answer a refused write. The service's code (or message) is the `detail` and `details.reason`, which the
 * sources page translates; a survey that isn't visible to the whole workspace keeps its own problem code.
 */
const mapSourceWriteError = (error: unknown, { requestId, instance }: TRequestContext): Response | null => {
  if (error instanceof OperationNotAllowedError && error.message === SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE) {
    return problemForbidden(requestId, error.message, instance, "survey_not_workspace_visible");
  }
  if (!(error instanceof InvalidInputError)) return null;
  const details = { reason: error.message };
  return SOURCE_CONFLICT_CODES.has(error.message)
    ? problemConflict(requestId, error.message, instance, { details })
    : problemUnprocessableContent(requestId, error.message, { instance, details });
};

const runWrite = async <T>(context: TRequestContext, write: () => Promise<T>): Promise<Response | T> => {
  try {
    return await write();
  } catch (error) {
    const mapped = mapSourceWriteError(error, context);
    if (mapped) return mapped;
    throw error;
  }
};

const sessionUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication ? (authentication.user?.id ?? null) : null;

/** A CSV source's field mappings, cleaned, or a refusal naming the required fields still missing. */
const toCsvFieldMappings = (fieldMappings: NonNullable<TFeedbackSourceCreateBody["fieldMappings"]>) => {
  const sanitized = sanitizeCsvFieldMappings(fieldMappings) ?? [];
  if (getMissingRequiredCsvFieldMappings(sanitized).length > 0) {
    throw new InvalidInputError(formatMissingRequiredCsvFieldMappingsMessage());
  }
  return sanitized;
};

/**
 * Authorize a request about one existing source: write access to its own workspace and to its dataset.
 * A missing source gets the same 403 as one the caller can't reach. A write names its target in the
 * audit entry first, so a refused attempt is still attributable.
 */
async function authorizeSource(context: TRequestContext, feedbackSourceId: string) {
  const { authentication, requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = feedbackSourceId;

  const userId = sessionUserId(authentication);
  const scope = await getFeedbackSourceScope(feedbackSourceId);
  if (!userId || !scope) return problemForbidden(requestId, FORBIDDEN, instance);

  const access = await requireSessionWorkspaceAccess(
    authentication,
    scope.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  await assertFeedbackSourceDirectoryAccess(userId, scope.feedbackDirectoryId, scope.workspaceId, "write");
  return { userId, scope };
}

/** `POST /api/internal/feedback-sources?workspaceId=`: add a source and its mappings to a workspace. */
export async function createFeedbackSourceOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TFeedbackSourceCreateBody }): Promise<Response> {
  const { authentication, requestId, instance, auditLog } = context;
  const userId = sessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, FORBIDDEN, instance);

  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.feedbackSourceMutation,
    userId,
    context
  );
  if (limited) return limited;

  // The dataset must be this organization's (otherwise the same 403 as no dataset at all) and assigned to
  // this workspace. The composite foreign key enforces the assignment too; this answers it first.
  const dataset = await prisma.feedbackDirectory.findUnique({
    where: { id: body.source.feedbackDirectoryId },
    select: { organizationId: true, workspaces: { where: { workspaceId }, select: { workspaceId: true } } },
  });
  if (dataset?.organizationId !== access.organizationId)
    return problemForbidden(requestId, FORBIDDEN, instance);
  if (dataset.workspaces.length === 0) {
    const reason = "FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE";
    return problemUnprocessableContent(requestId, reason, { instance, details: { reason } });
  }
  await assertFeedbackSourceDirectoryAccess(userId, body.source.feedbackDirectoryId, workspaceId, "write");

  const created = await runWrite(context, async () => {
    let mappings: TMappingsInput | undefined;
    if (body.formbricksMappings?.length) {
      mappings = await resolveFormbricksMappingsInput(body.formbricksMappings, workspaceId);
    } else if (body.fieldMappings?.length) {
      mappings = {
        type: "field",
        mappings: body.source.type === "csv" ? toCsvFieldMappings(body.fieldMappings) : body.fieldMappings,
      };
    }
    return createFeedbackSourceWithMappings(workspaceId, { ...body.source, createdBy: userId }, mappings);
  });
  if (created instanceof Response) return created;

  if (auditLog) {
    auditLog.targetId = created.id;
    auditLog.newObject = created;
  }
  return createdResponse<TFeedbackSourceWriteResource>(
    { id: created.id },
    { requestId, location: `/api/internal/feedback-sources/${created.id}` }
  );
}

/** `PATCH /api/internal/feedback-sources/{id}`: rename, pause or resume a source, or change its mappings. */
export async function updateFeedbackSourceOperation({
  feedbackSourceId,
  body,
  ...context
}: TRequestContext & { feedbackSourceId: string; body: TFeedbackSourceUpdateBody }): Promise<Response> {
  const authorized = await authorizeSource(context, feedbackSourceId);
  if (authorized instanceof Response) return authorized;
  const { userId, scope } = authorized;
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.feedbackSourceMutation,
    userId,
    context
  );
  if (limited) return limited;

  const updated = await runWrite(context, async () => {
    let mappings: TMappingsInput | undefined;
    if (body.formbricksMappings?.length) {
      mappings = await resolveFormbricksMappingsInput(
        body.formbricksMappings,
        scope.workspaceId,
        scope.formbricksMappings.map(({ surveyId }) => surveyId)
      );
    } else if (body.fieldMappings?.length) {
      mappings = {
        type: "field",
        mappings: scope.type === "csv" ? toCsvFieldMappings(body.fieldMappings) : body.fieldMappings,
      };
    }
    return updateFeedbackSourceWithMappings(feedbackSourceId, scope.workspaceId, body.source ?? {}, mappings);
  });
  if (updated instanceof Response) return updated;

  if (context.auditLog) {
    context.auditLog.oldObject = scope;
    context.auditLog.newObject = updated;
  }
  return successResponse<TFeedbackSourceWriteResource>({ id: updated.id }, { requestId: context.requestId });
}

/** `DELETE /api/internal/feedback-sources/{id}`: remove a source. Its records stay in the dataset. */
export async function deleteFeedbackSourceOperation({
  feedbackSourceId,
  ...context
}: TRequestContext & { feedbackSourceId: string }): Promise<Response> {
  const authorized = await authorizeSource(context, feedbackSourceId);
  if (authorized instanceof Response) return authorized;
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.feedbackSourceMutation,
    authorized.userId,
    context
  );
  if (limited) return limited;

  const deleted = await deleteFeedbackSource(feedbackSourceId, authorized.scope.workspaceId);
  if (context.auditLog) context.auditLog.oldObject = deleted;
  return noContentResponse({ requestId: context.requestId });
}

/**
 * `POST /api/internal/feedback-sources/{id}/imports`: replay one survey's past responses into the source.
 * Safe to repeat: the import reconciles rather than inserts.
 *
 * The survey must be in the source's own workspace — the import copies every response of it into the
 * source's dataset, and survey ids are public — readable by the caller, and visible to the whole
 * workspace, since copying responses into a dataset is outbound (ENG-3283).
 */
export async function importFeedbackSourceResponsesOperation({
  feedbackSourceId,
  body,
  ...context
}: TRequestContext & { feedbackSourceId: string; body: TFeedbackSourceImportBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const authorized = await authorizeSource(context, feedbackSourceId);
  if (authorized instanceof Response) return authorized;
  const { userId, scope } = authorized;
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.historicalResponseImport,
    userId,
    context
  );
  if (limited) return limited;

  const [feedbackSource, survey] = await Promise.all([
    getFeedbackSourceWithMappingsById(feedbackSourceId, scope.workspaceId),
    getSurvey(body.surveyId),
  ]);
  if (!feedbackSource || survey?.workspaceId !== scope.workspaceId) {
    return problemForbidden(requestId, FORBIDDEN, instance);
  }
  // ENG-3282: the import copies this survey's responses, so the caller must be able to read them.
  await assertCan({ type: "user", id: userId }, "survey.response_read", { type: "survey", id: survey.id });

  const result = await runWrite(context, async () => {
    await assertNewlyAttachedSurveysWorkspaceVisible([survey.id]);
    return importHistoricalResponses(feedbackSource, survey);
  });
  if (result instanceof Response) return result;

  if (auditLog) auditLog.newObject = result;
  return successResponse<TFeedbackSourceImportResource>(result, { requestId });
}
