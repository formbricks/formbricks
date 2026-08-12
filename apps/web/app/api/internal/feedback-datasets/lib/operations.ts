import "server-only";
import { problemBadGateway, problemServiceUnavailable, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { purgeHubFeedbackRecords } from "@/modules/hub/service";
import { isHubNotConfigured } from "@/modules/hub/utils";
import { requireFeedbackDatasetMutationAccess } from "./access";

type TPurgeDatasetParams = {
  authentication: TV3Authentication;
  datasetId: string;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Purge every feedback record in a dataset, keeping the dataset itself, its sources and its topic
 * taxonomy. The dataset id doubles as the Hub tenant id.
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
    auditLog.newObject = { purgeRequested: true, datasetId };
  }

  return successResponse({ datasetId, status: result.data.status }, { requestId, status: 202 });
}
