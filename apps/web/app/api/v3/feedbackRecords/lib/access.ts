import "server-only";
import type { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import { problemBadRequest, problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { retrieveFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { hubErrorToProblemResponse } from "./errors";

/**
 * Tenant isolation for the feedback-records surface. Two guards live here, and every operation goes
 * through at least one of them:
 *
 * - `resolveWorkspaceFeedbackTenant` — the workspace → dataset → Hub tenant choke point.
 * - `requireOwnedFeedbackRecord` — the per-record ownership check for the Hub endpoints that take a bare
 *   record id and derive the tenant from the record itself.
 *
 * Kept in its own module (mirroring `unify-feedback/taxonomy/lib/access.ts`) so the authorization rules
 * are reviewable in one place instead of being spread across the operations.
 */

type TResolveParams = {
  authentication: TV3Authentication;
  workspaceId: string;
  minPermission: "read" | "readWrite";
  requestId: string;
  instance: string;
  datasetId?: string;
};

export type TResolvedFeedbackTenant = {
  workspaceId: string;
  organizationId: string;
  tenantId: string;
  /** Name of the resolved dataset, echoed to the caller so a response is self-describing. */
  datasetName: string;
  allowedTenantIds: string[];
};

type TResolveResult = ({ ok: true } & TResolvedFeedbackTenant) | { ok: false; response: Response };

/**
 * Resolve (and authorize) the Hub tenant for a feedback-records request. This is the single tenant-
 * isolation choke point for every tool: workspace access → feedback-directories license gate →
 * dataset membership → the resolved Hub tenant (= the FeedbackDirectory id, `dataset_id` on the wire).
 * Mirrors the Unify read path (`modules/ee/unify-feedback/page.tsx`). `tenant_id` is never taken from caller input.
 */
export async function resolveWorkspaceFeedbackTenant({
  authentication,
  workspaceId,
  minPermission,
  requestId,
  instance,
  datasetId,
}: TResolveParams): Promise<TResolveResult> {
  const authResult = await requireUnifyFeedbackWorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (authResult instanceof Response) {
    return { ok: false, response: authResult };
  }

  const { workspaceId: resolvedWorkspaceId, organizationId } = authResult;

  const directories = await getFeedbackDirectoriesByWorkspaceId(resolvedWorkspaceId);
  // Normalised once, here: the Hub uses `tenant_id` verbatim — in SQL filters and, for semantic search, in
  // the vector query — with no trimming of its own, so a stray space silently matches nothing instead of
  // failing. Doing it at the source means every consumer gets a usable value; doing it per call site meant
  // whichever site was written last got it right.
  const allowedTenantIds = directories.map((directory) => directory.id.trim());

  if (datasetId) {
    // Trimmed on both sides: the id we hand back as `dataset_id` is normalised, so the value a caller
    // echoes on its next request must match a normalised id too, or a legitimate round trip would 403.
    const requested = directories.find((directory) => directory.id.trim() === datasetId.trim());
    if (!requested) {
      return {
        ok: false,
        response: problemForbidden(
          requestId,
          "You are not authorized to access this feedback dataset",
          instance
        ),
      };
    }
    return {
      ok: true,
      workspaceId: resolvedWorkspaceId,
      organizationId,
      tenantId: requested.id.trim(),
      datasetName: requested.name,
      allowedTenantIds,
    };
  }

  if (allowedTenantIds.length === 0) {
    return {
      ok: false,
      // Actionable on purpose: an agent hitting this can only help if the response says who has to do
      // what, and where. Datasets are organization-level, so a workspace member cannot self-serve.
      response: problemUnprocessableContent(
        requestId,
        "No feedback dataset is assigned to this workspace. An organization owner or manager can create one and grant this workspace access under Settings → Organization → Feedback Datasets.",
        { instance }
      ),
    };
  }
  if (allowedTenantIds.length > 1) {
    return {
      ok: false,
      response: problemBadRequest(
        requestId,
        "Multiple feedback datasets are assigned to this workspace; specify datasetId",
        { instance }
      ),
    };
  }

  return {
    ok: true,
    workspaceId: resolvedWorkspaceId,
    organizationId,
    tenantId: directories[0].id.trim(),
    datasetName: directories[0].name,
    allowedTenantIds,
  };
}

type TRequireMutationRoleParams = {
  authentication: TV3Authentication;
  /** The organization that owns the resolved dataset (from `resolveWorkspaceFeedbackTenant`). */
  organizationId: string;
  log: ReturnType<typeof logger.withContext>;
  requestId: string;
  instance: string;
};

/**
 * Assert that the caller may change a record that already exists — organization owners and managers
 * only (ENG-1770).
 *
 * The two guards above prove a record sits in one of the caller's datasets, which is not the same as it
 * belonging to the caller's workspace: a dataset is shared by every workspace it is assigned to, and a
 * record carries no workspace of its own. So a workspace `readWrite` member would otherwise edit or
 * delete records that another workspace's surveys ingested, in exactly the datasets they legitimately
 * read. Until Hub records carry a workspace, changing one stays with the roles that own org-level data.
 *
 * Only person-shaped principals are gated (sessions and OAuth/MCP tokens). An API key authorizes on its
 * per-workspace permissions instead, and what a key should need in order to mutate a record is being
 * settled separately in #8682 — so keys deliberately pass through here unchanged.
 *
 * Written as an allowlist rather than "no user id ⇒ allowed": an API key is the one shape that skips the
 * role check, and anything else that cannot be resolved to a user — a principal type added later, or a
 * session whose user never materialized — is refused. Not reachable today (the resolver above already
 * rejects an absent principal), but it means the pass-through stays deliberate instead of being implied
 * by a missing field.
 */
export async function requireFeedbackRecordMutationRole({
  authentication,
  organizationId,
  log,
  requestId,
  instance,
}: TRequireMutationRoleParams): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (authentication && "apiKeyId" in authentication) {
    return { ok: true };
  }

  const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;
  if (!userId) {
    log.warn({ statusCode: 403 }, "Feedback record mutation denied: principal resolved to no user");
    return { ok: false, response: forbidFeedbackRecordMutation(requestId, instance) };
  }

  try {
    await checkAuthorizationUpdated({
      userId,
      organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      log.warn({ statusCode: 403 }, "Feedback record mutation denied: not an organization owner or manager");
      return { ok: false, response: forbidFeedbackRecordMutation(requestId, instance) };
    }

    throw error;
  }
}

/** The single 403 for "you may not change records here", so every refusal reads identically. */
const forbidFeedbackRecordMutation = (requestId: string, instance: string): Response =>
  problemForbidden(
    requestId,
    "Only an organization owner or manager can change or delete a feedback record. Feedback datasets are shared across workspaces, so their records are organization-level data.",
    instance
  );

type TRequireOwnedRecordParams = {
  feedbackRecordId: string;
  resolution: TResolvedFeedbackTenant;
  /** Set when the caller pinned a dataset: the record must then live in *that* one, not merely in a permitted one. */
  datasetId?: string;
  log: ReturnType<typeof logger.withContext>;
  requestId: string;
  instance: string;
};

type TOwnedRecordResult = { ok: true; record: FeedbackRecordData } | { ok: false; response: Response };

/**
 * Assert that a feedback record belongs to the caller, and return it.
 *
 * Several Hub endpoints (`GET /{id}`, `GET /{id}/similar`, `DELETE /{id}`) take a bare record id and
 * derive the tenant from the stored record — the Hub delegates record-level authorization to us by
 * design. Without this guard each of them would be a cross-tenant primitive: a read oracle, a
 * neighbour-leak, and a destructive write respectively. So every one of them retrieves first, checks the
 * record's tenant against the caller's permitted set, and only then acts.
 *
 * A missing record and a foreign record return the *same* generic 403, so record ids can't be probed
 * across tenants. The response is identical per route, not per resource.
 */
export async function requireOwnedFeedbackRecord({
  feedbackRecordId,
  resolution,
  datasetId,
  log,
  requestId,
  instance,
}: TRequireOwnedRecordParams): Promise<TOwnedRecordResult> {
  const result = await retrieveFeedbackRecord(feedbackRecordId);
  if (result.error || !result.data) {
    const status = result.error?.status ?? 0;
    // Not found → generic 403, no existence oracle across tenants.
    if (status === 404) {
      // Logged like the tenant-mismatch denial below, so both halves of the 403 are observable.
      log.warn({ statusCode: 403, hubStatus: 404 }, "Feedback record not found");
      return { ok: false, response: forbidFeedbackRecord(requestId, instance) };
    }
    log.warn({ hubStatus: status, hubCode: result.error?.code }, "Hub retrieveFeedbackRecord failed");
    return { ok: false, response: hubErrorToProblemResponse(result.error, requestId, instance) };
  }

  // When the caller named a dataset, the record must live in THAT one; otherwise any dataset the
  // workspace owns is acceptable. Same 403 either way — see the doc comment above.
  const permittedTenantIds = datasetId ? [resolution.tenantId] : resolution.allowedTenantIds;
  if (!result.data.tenant_id || !permittedTenantIds.includes(result.data.tenant_id)) {
    log.warn({ statusCode: 403 }, "Feedback record tenant outside caller's workspace datasets");
    return { ok: false, response: forbidFeedbackRecord(requestId, instance) };
  }

  return { ok: true, record: result.data };
}

/**
 * The single record-level 403. Exported so every path that must be indistinguishable from the others —
 * the ownership guard above, and a record that vanishes mid-update — produces a byte-identical body by
 * construction rather than by two copies of the same string staying in sync.
 */
export const forbidFeedbackRecord = (requestId: string, instance: string): Response =>
  problemForbidden(requestId, "You are not authorized to access this feedback record", instance);
