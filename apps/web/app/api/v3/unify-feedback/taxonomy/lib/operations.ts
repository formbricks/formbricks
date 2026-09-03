import "server-only";
import { hubErrorToProblemResponse } from "@/app/api/v3/lib/hub-errors";
import {
  noContentResponse,
  problemUnauthorized,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import {
  createTaxonomyRun,
  getActiveTaxonomyTree,
  getTaxonomyRun,
  listTaxonomyFields,
  listTaxonomyNodeRecordCounts,
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  removeTaxonomyNode,
  renameTaxonomyNode,
} from "@/modules/hub/service";
import type { TaxonomyScopeInput, TaxonomyScopeType } from "@/modules/hub/types";
import { type HubError, isHubNotConfigured } from "@/modules/hub/utils";
import { getSessionUserId, requireUnifyDirectoryAccess, requireUnifyDirectoryMutationAccess } from "./access";

type TBaseParams = {
  authentication: TV3Authentication;
  workspaceId: string;
  directoryId: string;
  requestId: string;
  instance: string;
};

/**
 * Build the Hub scope for a request. Directory scope sends only `scope_type` (covers all text feedback
 * in the directory); field scope adds source/field. `sourceId` may be "" — the "no source" bucket.
 * Field-scope params are guaranteed present by the route schema's `requireFieldScopeParams` refine.
 */
function buildTaxonomyScope(
  directoryId: string,
  scopeType: TaxonomyScopeType,
  sourceType?: string,
  sourceId?: string,
  fieldId?: string
): TaxonomyScopeInput {
  if (scopeType === "directory") {
    return { tenant_id: directoryId, scope_type: "directory" };
  }
  return {
    tenant_id: directoryId,
    scope_type: "field",
    source_type: sourceType,
    source_id: sourceId ?? "",
    field_id: fieldId,
  };
}

/**
 * What a Hub 503 means for this surface.
 *
 * Names no single subsystem on purpose: the Hub answers 503 for taxonomy from three unrelated causes
 * (no taxonomy service wired up, no embedding model configured, or the run failing to start), and only
 * some are reachable from this UI — a message naming just one would be wrong in the others. It points a
 * self-hoster at both candidates instead of guessing between them.
 */
const TAXONOMY_UNAVAILABLE_DETAIL =
  "Topic analysis is not available: a part of the feedback service it depends on is not configured on this deployment. A self-hosting administrator can check the Hub's taxonomy and embedding configuration.";

/**
 * `fields` and `state` return 200 with an `unavailable` flag on Hub error / NO_CONFIG (mirroring the
 * legacy actions) so a transient Hub blip never trips a false "not enough feedback"/"embedding" gate.
 * The other endpoints return a problem response (see `hubErrorToProblemResponse`) so React Query
 * surfaces an error state and the UI can retry.
 *
 * The flag carries no message on purpose: the UI renders a localized alert off the boolean, so any
 * string sent from here would either go unused or ship untranslated.
 */

export async function listV3TaxonomyFields(params: TBaseParams): Promise<Response> {
  const { authentication, workspaceId, directoryId, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const result = await listTaxonomyFields(directoryId);
  if (result.error) {
    return successResponse({ fields: [], unavailable: true }, { requestId });
  }

  return successResponse({ fields: result.data?.data ?? [], unavailable: false }, { requestId });
}

export async function getV3TaxonomyState(
  params: TBaseParams & {
    scopeType: TaxonomyScopeType;
    sourceType?: string;
    sourceId?: string;
    fieldId?: string;
  }
): Promise<Response> {
  const {
    authentication,
    workspaceId,
    directoryId,
    scopeType,
    sourceType,
    sourceId,
    fieldId,
    requestId,
    instance,
  } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const scope = buildTaxonomyScope(directoryId, scopeType, sourceType, sourceId, fieldId);

  const [activeTree, runs] = await Promise.all([
    getActiveTaxonomyTree(scope),
    listTaxonomyRuns({ ...scope, limit: 5 }),
  ]);

  if (runs.error) {
    return successResponse({ activeTree: null, runs: [], unavailable: true }, { requestId });
  }

  // A 404 from the active-tree endpoint means "no active taxonomy yet", not an outage.
  const treeUnavailable = Boolean(activeTree.error && activeTree.error.status !== 404);
  return successResponse(
    {
      activeTree: activeTree.error?.status === 404 ? null : (activeTree.data ?? null),
      runs: runs.data?.data ?? [],
      unavailable: treeUnavailable,
    },
    { requestId }
  );
}

export async function getV3TaxonomyRun(params: TBaseParams & { runId: string }): Promise<Response> {
  const { authentication, workspaceId, directoryId, runId, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const result = await getTaxonomyRun(runId, directoryId);
  if (result.error || !result.data) {
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to load taxonomy run",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
      notFound: { resourceType: "Taxonomy run", resourceId: runId },
    });
  }

  return successResponse(result.data, { requestId });
}

export async function getV3TaxonomyNodeRecordCounts(
  params: TBaseParams & { runId: string }
): Promise<Response> {
  const { authentication, workspaceId, directoryId, runId, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const result = await listTaxonomyNodeRecordCounts(runId, directoryId);
  if (result.error || !result.data) {
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to load record counts",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
      notFound: { resourceType: "Taxonomy run", resourceId: runId },
    });
  }

  return successResponse({ counts: result.data.counts }, { requestId });
}

export async function triggerV3TaxonomyRun(
  params: TBaseParams & {
    scopeType: TaxonomyScopeType;
    sourceType?: string;
    sourceId?: string;
    fieldId?: string;
    fieldLabel?: string;
  }
): Promise<Response> {
  const {
    authentication,
    workspaceId,
    directoryId,
    scopeType,
    sourceType,
    sourceId,
    fieldId,
    fieldLabel,
    requestId,
    instance,
  } = params;

  const access = await requireUnifyDirectoryMutationAccess(
    authentication,
    workspaceId,
    directoryId,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const actorId = getSessionUserId(authentication);
  if (!actorId) return problemUnauthorized(requestId, "Session required", instance);

  const result = await createTaxonomyRun({
    ...buildTaxonomyScope(directoryId, scopeType, sourceType, sourceId, fieldId),
    // field_label is a field-scope nicety; directory runs derive their own label on the Hub side.
    field_label: scopeType === "field" ? fieldLabel : undefined,
    actor_id: actorId,
  });
  if (result.error || !result.data) {
    // No `notFound` mapping: this creates a run, so a 404 says nothing useful about the request.
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to start taxonomy generation",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
    });
  }

  return successResponse({ run: result.data.run, inProgress: result.data.in_progress }, { requestId });
}

export async function getV3TaxonomyNodeRecords(
  params: TBaseParams & { nodeId: string; limit: number }
): Promise<Response> {
  const { authentication, workspaceId, directoryId, nodeId, limit, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const result = await listTaxonomyNodeRecords(nodeId, { tenant_id: directoryId, limit });
  if (result.error || !result.data) {
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to load feedback records",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
  }

  return successListResponse(result.data.data, { limit: result.data.limit }, { requestId });
}

export async function renameV3TaxonomyNode(
  params: TBaseParams & { nodeId: string; label: string }
): Promise<Response> {
  const { authentication, workspaceId, directoryId, nodeId, label, requestId, instance } = params;

  const access = await requireUnifyDirectoryMutationAccess(
    authentication,
    workspaceId,
    directoryId,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const actorId = getSessionUserId(authentication);
  if (!actorId) return problemUnauthorized(requestId, "Session required", instance);

  const result = await renameTaxonomyNode(nodeId, {
    tenant_id: directoryId,
    actor_id: actorId,
    label,
  });
  if (result.error || !result.data) {
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to rename taxonomy node",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
  }

  return successResponse(result.data, { requestId });
}

export async function removeV3TaxonomyNode(params: TBaseParams & { nodeId: string }): Promise<Response> {
  const { authentication, workspaceId, directoryId, nodeId, requestId, instance } = params;

  const access = await requireUnifyDirectoryMutationAccess(
    authentication,
    workspaceId,
    directoryId,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const actorId = getSessionUserId(authentication);
  if (!actorId) return problemUnauthorized(requestId, "Session required", instance);

  const result = await removeTaxonomyNode(nodeId, { tenant_id: directoryId, actor_id: actorId });
  if (result.error || !result.data) {
    return hubErrorToProblemResponse(result.error, requestId, instance, {
      badGatewayDetail: "Failed to remove taxonomy node",
      serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
  }

  return noContentResponse({ requestId });
}
