import "server-only";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import type { TEnrichmentStatusResponse } from "@/modules/ee/unify-feedback/enrichment-status/lib/enrichment";
import { getEnrichmentStatus } from "@/modules/hub/service";
import type { EnrichmentStatusResponse } from "@/modules/hub/types";
import { aggregateEnrichmentStatus } from "./aggregate";

/**
 * Enrichment progress for every feedback directory assigned to a workspace.
 *
 * The Hub authenticates with a single shared API key and trusts the `tenant_id` it is handed, so the
 * authorization has to happen here: workspace access plus the `feedbackDirectories` entitlement, then
 * the tenant ids are read off the workspace's own directories. Nothing tenant-identifying comes from
 * the caller.
 *
 * The indicator is a non-critical enhancement above the records table, so a Hub that is down or
 * unconfigured degrades to `unavailable: true` with a 200 rather than erroring — the client reads that
 * flag to render nothing and stop polling, exactly as the taxonomy fields read does.
 */
export async function getV3EnrichmentStatus(params: {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const { authentication, workspaceId, requestId, instance } = params;

  const context = await requireUnifyFeedbackWorkspaceAccess(
    authentication,
    workspaceId,
    "read",
    requestId,
    instance
  );
  if (context instanceof Response) return context;

  const directories = await getFeedbackDirectoriesByWorkspaceId(context.workspaceId);
  if (directories.length === 0) {
    return successResponse<TEnrichmentStatusResponse>({ enrichments: [], unavailable: false }, { requestId });
  }

  const results = await Promise.all(directories.map((directory) => getEnrichmentStatus(directory.id)));

  // A directory that failed is left out rather than counted as zero — folding a failure in as "nothing
  // done yet" would invent a backlog. If every directory failed there is nothing to show at all.
  const statuses = results
    .map((result) => result.data)
    .filter((data): data is EnrichmentStatusResponse => data !== null);

  if (statuses.length === 0) {
    return successResponse<TEnrichmentStatusResponse>({ enrichments: [], unavailable: true }, { requestId });
  }

  return successResponse<TEnrichmentStatusResponse>(
    { enrichments: aggregateEnrichmentStatus(statuses), unavailable: false },
    { requestId }
  );
}
