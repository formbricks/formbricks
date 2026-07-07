import "server-only";
import {
  noContentResponse,
  problemBadGateway,
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
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  removeTaxonomyNode,
  renameTaxonomyNode,
} from "@/modules/hub/service";
import { getSessionUserId, requireUnifyDirectoryAccess } from "./access";

type TBaseParams = {
  authentication: TV3Authentication;
  workspaceId: string;
  directoryId: string;
  requestId: string;
  instance: string;
};

/**
 * `fields` and `state` return 200 with an `unavailable` flag on Hub error / NO_CONFIG (mirroring the
 * legacy actions) so a transient Hub blip never trips a false "not enough feedback"/"embedding" gate.
 * The other endpoints return 502 so React Query surfaces an error state and the UI can retry.
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
    return successResponse(
      {
        fields: [],
        unavailable: true,
        unavailableMessage: result.error.message || "Taxonomy fields are unavailable",
      },
      { requestId }
    );
  }

  return successResponse({ fields: result.data?.data ?? [], unavailable: false }, { requestId });
}

export async function getV3TaxonomyState(
  params: TBaseParams & { sourceType: string; sourceId: string; fieldId: string }
): Promise<Response> {
  const { authentication, workspaceId, directoryId, sourceType, sourceId, fieldId, requestId, instance } =
    params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const scope = {
    tenant_id: directoryId,
    source_type: sourceType,
    source_id: sourceId,
    field_id: fieldId,
  };

  const [activeTree, runs] = await Promise.all([
    getActiveTaxonomyTree(scope),
    listTaxonomyRuns({ ...scope, limit: 5 }),
  ]);

  if (runs.error) {
    return successResponse(
      {
        activeTree: null,
        runs: [],
        unavailable: true,
        unavailableMessage: runs.error.message || "Taxonomy runs are unavailable",
      },
      { requestId }
    );
  }

  // A 404 from the active-tree endpoint means "no active taxonomy yet", not an outage.
  const treeUnavailable = Boolean(activeTree.error && activeTree.error.status !== 404);
  return successResponse(
    {
      activeTree: activeTree.error?.status === 404 ? null : (activeTree.data ?? null),
      runs: runs.data?.data ?? [],
      unavailable: treeUnavailable,
      unavailableMessage: treeUnavailable
        ? activeTree.error?.message || "Active taxonomy is unavailable"
        : undefined,
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
    return problemBadGateway(requestId, result.error?.message || "Failed to load taxonomy run", instance);
  }

  return successResponse(result.data, { requestId });
}

export async function triggerV3TaxonomyRun(
  params: TBaseParams & { sourceType: string; sourceId: string; fieldId: string; fieldLabel?: string }
): Promise<Response> {
  const {
    authentication,
    workspaceId,
    directoryId,
    sourceType,
    sourceId,
    fieldId,
    fieldLabel,
    requestId,
    instance,
  } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const actorId = getSessionUserId(authentication);
  if (!actorId) return problemUnauthorized(requestId, "Session required", instance);

  const result = await createTaxonomyRun({
    tenant_id: directoryId,
    source_type: sourceType,
    source_id: sourceId,
    field_id: fieldId,
    field_label: fieldLabel,
    actor_id: actorId,
  });
  if (result.error || !result.data) {
    return problemBadGateway(
      requestId,
      result.error?.message || "Failed to start taxonomy generation",
      instance
    );
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
    return problemBadGateway(requestId, result.error?.message || "Failed to load feedback records", instance);
  }

  return successListResponse(result.data.data, { limit: result.data.limit }, { requestId });
}

export async function renameV3TaxonomyNode(
  params: TBaseParams & { nodeId: string; label: string }
): Promise<Response> {
  const { authentication, workspaceId, directoryId, nodeId, label, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "readWrite",
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
    return problemBadGateway(requestId, result.error?.message || "Failed to rename taxonomy node", instance);
  }

  return successResponse(result.data, { requestId });
}

export async function removeV3TaxonomyNode(params: TBaseParams & { nodeId: string }): Promise<Response> {
  const { authentication, workspaceId, directoryId, nodeId, requestId, instance } = params;

  const access = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const actorId = getSessionUserId(authentication);
  if (!actorId) return problemUnauthorized(requestId, "Session required", instance);

  const result = await removeTaxonomyNode(nodeId, { tenant_id: directoryId, actor_id: actorId });
  if (result.error || !result.data) {
    return problemBadGateway(requestId, result.error?.message || "Failed to remove taxonomy node", instance);
  }

  return noContentResponse({ requestId });
}
