import "server-only";
import {
  noContentResponse,
  problemBadGateway,
  problemNotFound,
  problemServiceUnavailable,
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
import { getSessionUserId, requireUnifyDirectoryAccess } from "./access";

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

type THubFailureOptions = {
  requestId: string;
  instance: string;
  /** The 502 detail. Static text only — never the Hub's own message (see below). */
  fallbackDetail: string;
  /**
   * When set, a Hub 404 maps to a 404 for this resource. Omit it on creates, where "not found" says
   * nothing useful about the request.
   */
  notFound?: { resourceType: string; resourceId: string };
};

/**
 * Turns a failed Hub call into the right problem response.
 *
 * Not every Hub failure is a fault: a 404 is the benign "gone, or never existed" — a stale run id, a
 * node someone else just removed — and returning that as a 502 both misreads to the caller as a server
 * crash and counts a normal outcome towards the 5xx rate. NO_CONFIG means the integration is switched
 * off on this deployment, which is a 503. Everything else — 5xx, timeout, connection, or a null payload
 * with no error at all — is a genuine upstream failure and stays a 502.
 *
 * The 404 is not an existence oracle: every caller checks directory access first and scopes the Hub
 * call by `tenant_id`, so it only ever means "not in *your* directory".
 *
 * The Hub's own error text is never relayed. The SDK folds the entire RFC 9457 problem body into
 * `message`, so echoing it puts internal Hub URLs and problem codes into a customer-facing response.
 * The full error is already logged in `@/modules/hub/service`; correlate on `requestId`.
 */
function hubFailureResponse(error: HubError | null, options: THubFailureOptions): Response {
  const { requestId, instance, fallbackDetail, notFound } = options;

  if (error) {
    if (error.status === 404 && notFound) {
      return problemNotFound(requestId, notFound.resourceType, notFound.resourceId, instance);
    }
    if (isHubNotConfigured(error)) {
      return problemServiceUnavailable(
        requestId,
        "The Hub integration is not configured on this deployment.",
        instance
      );
    }
  }

  return problemBadGateway(requestId, fallbackDetail, instance);
}

/**
 * `fields` and `state` return 200 with an `unavailable` flag on Hub error / NO_CONFIG (mirroring the
 * legacy actions) so a transient Hub blip never trips a false "not enough feedback"/"embedding" gate.
 * The other endpoints return a problem response (see `hubFailureResponse`) so React Query surfaces an
 * error state and the UI can retry.
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
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to load taxonomy run",
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
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to load record counts",
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
    ...buildTaxonomyScope(directoryId, scopeType, sourceType, sourceId, fieldId),
    // field_label is a field-scope nicety; directory runs derive their own label on the Hub side.
    field_label: scopeType === "field" ? fieldLabel : undefined,
    actor_id: actorId,
  });
  if (result.error || !result.data) {
    // No `notFound` mapping: this creates a run, so a 404 says nothing useful about the request.
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to start taxonomy generation",
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
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to load feedback records",
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
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
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to rename taxonomy node",
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
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
    return hubFailureResponse(result.error, {
      requestId,
      instance,
      fallbackDetail: "Failed to remove taxonomy node",
      notFound: { resourceType: "Taxonomy node", resourceId: nodeId },
    });
  }

  return noContentResponse({ requestId });
}
