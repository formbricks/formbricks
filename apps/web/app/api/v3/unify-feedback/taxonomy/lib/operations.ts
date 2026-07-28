import "server-only";
import { logger } from "@formbricks/logger";
import { hubErrorToProblemResponse } from "@/app/api/v3/lib/hub-errors";
import {
  noContentResponse,
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
import type { HubError } from "@/modules/hub/utils";
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

/**
 * `fields` and `state` return 200 with an `unavailable` flag on Hub error / NO_CONFIG (mirroring the
 * legacy actions) so a transient Hub blip never trips a false "not enough feedback"/"embedding" gate.
 * Their `unavailableMessage` is a fixed string: the upstream text is logged, never returned (see below).
 *
 * The other endpoints map the Hub's status through `taxonomyHubErrorResponse` — a Hub 400/409 surfaces as
 * itself with its (bounded) detail, a 404 as a 404 so the client can stop polling, a 503 as a 503, and
 * anything else as a generic 502.
 */

/**
 * What a Hub 503 means here. Deliberately *not* the feedback-records wording: the Hub returns 503 for
 * taxonomy when either embeddings **or** the taxonomy compute service is unconfigured
 * (`taxonomy_handler.go` / `taxonomy_service.go`), and the embeddings case is unreachable through the UI
 * anyway — unset embeddings make `/fields` report `unavailable`, which disables the Generate button. So a
 * message naming only embeddings would be wrong in exactly the case a user can reach. Retry-honest,
 * because the compute service can also reject a run transiently.
 */
const TAXONOMY_UNAVAILABLE_DETAIL =
  "Taxonomy generation is unavailable: the feedback service has no embedding model or no taxonomy compute service configured. If this is transient, retry in a few minutes; otherwise a self-hosting administrator can check EMBEDDING_MODEL and the taxonomy service on the Hub.";

/** Fixed, caller-safe replacements for the three 200-with-`unavailable` paths. */
const FIELDS_UNAVAILABLE_MESSAGE = "Taxonomy fields are unavailable";
const RUNS_UNAVAILABLE_MESSAGE = "Taxonomy runs are unavailable";
const ACTIVE_TREE_UNAVAILABLE_MESSAGE = "Active taxonomy is unavailable";

/**
 * Taxonomy's Hub-error policy. Two statuses mean something specific here; the rest go through the shared
 * mapping, which is also what bounds how much of an upstream 4xx detail may be echoed.
 *
 * The Hub can only return 0 (network / no config), 400, 401, 404, 409, 500 and 503 on these endpoints — it
 * has no 429, 413 or 422 path for taxonomy, so those branches of the shared mapper are unreachable from
 * here and are deliberately untested on this surface.
 */
function taxonomyHubErrorResponse(
  error: HubError | null,
  requestId: string,
  instance: string,
  resource: string
): Response {
  if (error?.status === 503) {
    return problemServiceUnavailable(requestId, TAXONOMY_UNAVAILABLE_DETAIL, instance);
  }
  // No resource id in the body: the client only needs "this is gone, stop asking". A Hub 404 covers both
  // "no such run" and "not this tenant's run", so it is not an existence oracle either way.
  if (error?.status === 404) {
    return problemNotFound(requestId, resource, null, instance);
  }
  return hubErrorToProblemResponse(error, requestId, instance, {
    serviceUnavailableDetail: TAXONOMY_UNAVAILABLE_DETAIL,
  });
}

/**
 * A Hub status that describes the caller's own request rather than a fault on our side. Note that 401/403
 * are excluded on purpose: from the caller's perspective those are *our* credentials failing, they surface
 * as a generic 502, and logging them quietly would leave that outage with no explanation anywhere.
 */
const CALLER_FAULT_HUB_STATUSES = new Set([400, 404, 409, 413, 422]);

/**
 * Log a Hub failure server-side — the diagnostic the response deliberately no longer carries. Context is
 * ids and statuses only: never the request body, the node label, or record content.
 */
function logHubFailure(params: TBaseParams, error: HubError | null, operation: string): void {
  const { requestId, workspaceId, directoryId } = params;
  const log = logger.withContext({ requestId, workspaceId, directoryId });
  const hubStatus = error?.status ?? 0;
  const context = { hubStatus, hubCode: error?.code };

  // Nothing is broken and the caller already got the detail in the response, so no stack and no upstream
  // text — the one place a Hub 4xx can echo caller input back at us.
  if (CALLER_FAULT_HUB_STATUSES.has(hubStatus)) {
    log.warn(context, `Hub rejected ${operation}`);
    return;
  }
  // `err` and not `error`: pino's stdSerializers.err is registered for that key only.
  log.error({ ...context, err: error }, `Hub ${operation} failed`);
}

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
    logHubFailure(params, result.error, "listFields");
    return successResponse(
      { fields: [], unavailable: true, unavailableMessage: FIELDS_UNAVAILABLE_MESSAGE },
      { requestId }
    );
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
    logHubFailure(params, runs.error, "listRuns");
    return successResponse(
      { activeTree: null, runs: [], unavailable: true, unavailableMessage: RUNS_UNAVAILABLE_MESSAGE },
      { requestId }
    );
  }

  // A 404 from the active-tree endpoint means "no active taxonomy yet", not an outage.
  const treeUnavailable = Boolean(activeTree.error && activeTree.error.status !== 404);
  if (treeUnavailable) {
    logHubFailure(params, activeTree.error, "getActiveTree");
  }
  return successResponse(
    {
      activeTree: activeTree.error?.status === 404 ? null : (activeTree.data ?? null),
      runs: runs.data?.data ?? [],
      unavailable: treeUnavailable,
      unavailableMessage: treeUnavailable ? ACTIVE_TREE_UNAVAILABLE_MESSAGE : undefined,
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
    logHubFailure(params, result.error, "getRun");
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy run");
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
    logHubFailure(params, result.error, "getRecordCounts");
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy run");
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
    logHubFailure(params, result.error, "startRun");
    // The most common failure here is a Hub 400 ("at least N embedded text records are required; found
    // M") — squarely the caller's own situation, so the shared mapper relays that detail (bounded).
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy run");
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
    logHubFailure(params, result.error, "getNodeRecords");
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy node");
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
    logHubFailure(params, result.error, "renameNode");
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy node");
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
    logHubFailure(params, result.error, "removeNode");
    return taxonomyHubErrorResponse(result.error, requestId, instance, "Taxonomy node");
  }

  return noContentResponse({ requestId });
}
