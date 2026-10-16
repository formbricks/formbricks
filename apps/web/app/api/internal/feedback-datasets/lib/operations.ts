import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";
import { applyRateLimitOrRespond } from "@/app/api/internal/lib/rate-limit";
import {
  createdResponse,
  problemBadGateway,
  problemConflict,
  problemForbidden,
  problemServiceUnavailable,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createFeedbackDirectory,
  getFeedbackDirectoryDetails,
  updateFeedbackDirectory,
} from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { purgeHubFeedbackRecords } from "@/modules/hub/service";
import { isHubNotConfigured } from "@/modules/hub/utils";
import { requireFeedbackDatasetMutationAccess, requireFeedbackDatasetOrganizationAccess } from "./access";
import type { TDatasetCreateBody, TDatasetUpdateBody } from "./schemas";

type TPurgeDatasetParams = {
  authentication: TV3Authentication;
  datasetId: string;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Purge every feedback record in a dataset, plus the topics generated from them, keeping the dataset
 * itself and its sources. The dataset id doubles as the Hub tenant id.
 *
 * Returns 202, not 204: the Hub runs the purge as a background job, so the records are not gone when
 * this responds, and reporting a deleted count here would be inventing one. The dashboard does not
 * poll for completion — it lists datasets, not records — so its success message says the deletion
 * has started rather than finished.
 */
export async function purgeV3FeedbackDataset(params: TPurgeDatasetParams): Promise<Response> {
  const { authentication, datasetId, requestId, instance, auditLog } = params;

  // Set before the guard so a denied attempt is still attributable to the dataset it targeted.
  if (auditLog) {
    auditLog.targetId = datasetId;
  }

  const access = await requireFeedbackDatasetMutationAccess(authentication, datasetId, requestId, instance);
  if (access instanceof Response) return access;

  if (auditLog) {
    auditLog.organizationId = access.organizationId;
  }

  const result = await purgeHubFeedbackRecords(datasetId);
  if (result.error || !result.data) {
    // The Hub's own error text is never relayed — the SDK folds the whole problem body into
    // `message`, which would put internal Hub URLs into a dashboard response. Correlate on
    // requestId; the full error is logged in @/modules/hub/service.
    if (result.error && isHubNotConfigured(result.error)) {
      return problemServiceUnavailable(
        requestId,
        "The Hub integration is not configured on this deployment.",
        instance
      );
    }

    return problemBadGateway(requestId, "Failed to purge the dataset's feedback records", instance);
  }

  if (auditLog) {
    // Records what was *requested*, not what was removed: the count is not known at this point and
    // the purge may still be running.
    // targetId already carries the dataset; this records only that a purge was accepted.
    auditLog.newObject = { purgeRequested: true };
  }

  return successResponse({ datasetId, status: result.data.status }, { requestId, status: 202 });
}

/**
 * A dataset write the service refused with one of its codes (`DIRECTORY_NAME_DUPLICATE`, …). The code is
 * the `detail` and `details.reason`, which the settings UI translates; it never carries anything else.
 * A clash with what is stored is a 409, a workspace from another organization a 422.
 */
const DATASET_CONFLICT_CODES = new Set([
  "DIRECTORY_NAME_DUPLICATE",
  "DIRECTORY_HAS_FEEDBACK_SOURCES",
  "DIRECTORY_WORKSPACE_HAS_FEEDBACK_SOURCES",
  "WORKSPACE_ALREADY_ASSIGNED_TO_DIFFERENT_DIRECTORY",
]);

const mapDatasetWriteError = (error: unknown, requestId: string, instance?: string): Response | null => {
  if (!(error instanceof InvalidInputError)) return null;
  const details = { reason: error.message };
  return DATASET_CONFLICT_CODES.has(error.message)
    ? problemConflict(requestId, error.message, instance, { details })
    : problemUnprocessableContent(requestId, error.message, { instance, details });
};

type TDatasetRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/** The dataset as stored, for a route that has just authorized it; gone in between reads as forbidden. */
const readDatasetDetails = async (datasetId: string, requestId: string, instance?: string) =>
  (await getFeedbackDirectoryDetails(datasetId)) ??
  problemForbidden(requestId, "You are not authorized to access this resource", instance);

/** `POST /api/internal/feedback-datasets?organizationId=`: create a dataset. Owners and managers. */
export async function createFeedbackDatasetOperation({
  organizationId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDatasetRequestContext & { organizationId: string; body: TDatasetCreateBody }): Promise<Response> {
  if (auditLog) auditLog.organizationId = organizationId;
  const access = await requireFeedbackDatasetOrganizationAccess(
    authentication,
    organizationId,
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  const { userId } = access;
  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.feedbackDirectoryMutation, userId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  let datasetId: string;
  try {
    datasetId = await createFeedbackDirectory(organizationId, body.name, body.workspaceIds);
  } catch (error) {
    const mapped = mapDatasetWriteError(error, requestId, instance);
    if (mapped) return mapped;
    throw error;
  }

  const details = await readDatasetDetails(datasetId, requestId, instance);
  if (details instanceof Response) return details;
  if (auditLog) {
    auditLog.targetId = datasetId;
    auditLog.newObject = details;
  }
  capturePostHogEvent(
    userId,
    "feedback_directory_created",
    { feedback_directory_id: datasetId },
    { organizationId }
  );
  return createdResponse(details, { requestId, location: `/api/internal/feedback-datasets/${datasetId}` });
}

/** `GET /api/internal/feedback-datasets/{datasetId}`: a dataset with its workspaces and sources. */
export async function getFeedbackDatasetOperation({
  datasetId,
  authentication,
  requestId,
  instance,
}: TDatasetRequestContext & { datasetId: string }): Promise<Response> {
  const access = await requireFeedbackDatasetMutationAccess(authentication, datasetId, requestId, instance);
  if (access instanceof Response) return access;

  const details = await readDatasetDetails(datasetId, requestId, instance);
  if (details instanceof Response) return details;
  return successResponse(details, { requestId });
}

/** `PATCH /api/internal/feedback-datasets/{datasetId}`: rename, reassign, archive or unarchive it. */
export async function updateFeedbackDatasetOperation({
  datasetId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDatasetRequestContext & { datasetId: string; body: TDatasetUpdateBody }): Promise<Response> {
  // Set before the guard so a denied attempt is still attributable to the dataset it targeted.
  if (auditLog) auditLog.targetId = datasetId;
  const access = await requireFeedbackDatasetMutationAccess(authentication, datasetId, requestId, instance);
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.feedbackDirectoryMutation,
    access.userId,
    { requestId, instance }
  );
  if (limited) return limited;

  const before = await readDatasetDetails(datasetId, requestId, instance);
  if (before instanceof Response) return before;
  try {
    await updateFeedbackDirectory(datasetId, access.organizationId, body);
  } catch (error) {
    const mapped = mapDatasetWriteError(error, requestId, instance);
    if (mapped) return mapped;
    throw error;
  }

  const after = await readDatasetDetails(datasetId, requestId, instance);
  if (after instanceof Response) return after;
  if (auditLog) {
    auditLog.oldObject = before;
    auditLog.newObject = after;
  }
  return successResponse(after, { requestId });
}
