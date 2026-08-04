import "server-only";
import type { TApiKeyProjectionTargets } from "./api-key";
import {
  type TAuthzedObservationSummary,
  type TAuthzedParentEdge,
  type TAuthzedSourceRef,
  findUnprojectedSourceRefs,
  getManagedResourceTypes,
  sourceRefKey,
  summarizeObservation,
} from "./backfill-diff";
import {
  type TAuthzedApiKeyWorkspaceTarget,
  type TAuthzedMembershipTarget,
  type TAuthzedOrganizationSource,
  type TAuthzedTeamMembershipTarget,
  type TAuthzedWorkspaceSource,
  type TAuthzedWorkspaceTeamTarget,
  findMismatchedParentEdges,
  findMissingSourceRefs,
  organizationExists,
  readOrganizationIdPage,
  readOrganizationSource,
  readWorkspaceSource,
} from "./backfill-source";
import type { TAuthzedClient, TAuthzedRelationship } from "./client";
import {
  AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
  AUTHZED_BACKFILL_TARGET_CHUNK_SIZE,
  AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES,
  AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
  AUTHZED_MAX_TRACKED_ORPHAN_REFS,
} from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import type { TOrganizationMembershipProjectionTargets } from "./organization-membership";
import type { TAuthzedProjectionResult } from "./projection";
import { forEachRelationshipPage, readAllRelationships } from "./relationship-reads";
import type { TTeamWorkspaceProjectionTargets } from "./team-workspace";

/**
 * Relationship backfill and repair, organized around one organization at a time.
 *
 * **Command-line use only** — see the note on `./backfill-source`. This module performs no
 * authorization check, because it runs as an operator against the whole database.
 *
 * The organization is the unit of work because every authorization-relevant model reaches
 * `Organization` in one hop or two, so an organization's target set is closed and can be reconciled
 * without consulting any other. It also means backfill and single-organization repair are the same
 * code path with a different unit list, and that a partial run leaves complete graphs for the
 * organizations it finished rather than a fragment of every tenant's graph.
 *
 * This module cannot write. It reaches mutations only through an injected capability object, and it
 * imports neither `getAuthzedClient` nor any reconciler — so a dry run is inert by construction rather
 * than by remembering to check a flag.
 */

/** Mutation capability. Supplied by the CLI; a dry run supplies no-ops. */
export type TAuthzedBackfillApply = Readonly<{
  reconcileApiKeys: (targets: TApiKeyProjectionTargets) => Promise<TAuthzedProjectionResult>;
  reconcileMemberships: (
    targets: TOrganizationMembershipProjectionTargets
  ) => Promise<TAuthzedProjectionResult>;
  reconcileTeamWorkspace: (targets: TTeamWorkspaceProjectionTargets) => Promise<TAuthzedProjectionResult>;
}>;

export type TAuthzedBackfillScope =
  | Readonly<{ afterOrganizationId?: string; kind: "all" }>
  | Readonly<{ kind: "organization"; organizationId: string }>
  | Readonly<{ kind: "workspace"; workspaceId: string }>;

export type TAuthzedBackfillRequest = Readonly<{
  maxPrune: number;
  mode: "apply" | "dry_run";
  /**
   * Whether relationships with no source record may be removed.
   *
   * Note that "no prune" does not mean "no deletes": converging a membership inherently deletes the
   * roles it does not hold. What pruning adds is permission to reconcile records observed *only* in
   * SpiceDB — the ones PostgreSQL has no row for at all.
   */
  prune: boolean;
  scope: TAuthzedBackfillScope;
}>;

/**
 * PostgreSQL reads the orchestrator needs.
 *
 * Injected rather than imported so the orchestrator can be driven against a real SpiceDB without a
 * database — which is how the compose smoke test exercises the observation, classification, and prune
 * paths end to end. Note these are reads only; the mutation capability stays separate, so injecting
 * them does not weaken the dry-run guarantee.
 */
export type TAuthzedBackfillSource = Readonly<{
  findMismatchedParentEdges: (
    edges: ReadonlyArray<TAuthzedParentEdge>
  ) => Promise<ReadonlyArray<TAuthzedParentEdge>>;
  findMissingSourceRefs: (
    refs: ReadonlyArray<TAuthzedSourceRef>
  ) => Promise<ReadonlyArray<TAuthzedSourceRef>>;
  organizationExists: (organizationId: string) => Promise<boolean>;
  readOrganizationIdPage: (
    page: Readonly<{ afterOrganizationId?: string; limit?: number }>
  ) => Promise<ReadonlyArray<string>>;
  readOrganizationSource: (organizationId: string) => Promise<TAuthzedOrganizationSource>;
  readWorkspaceSource: (workspaceId: string) => Promise<TAuthzedWorkspaceSource>;
}>;

export const defaultBackfillSource: TAuthzedBackfillSource = {
  findMismatchedParentEdges,
  findMissingSourceRefs,
  organizationExists,
  readOrganizationIdPage,
  readOrganizationSource,
  readWorkspaceSource,
};

export type TAuthzedBackfillDependencies = Readonly<{
  apply: TAuthzedBackfillApply;
  /** Read-only slice of the facade. Deliberately not the whole client. */
  client: Pick<TAuthzedClient, "readRelationships">;
  source?: TAuthzedBackfillSource;
}>;

export type TAuthzedBackfillCounters = Readonly<{
  failed: number;
  /**
   * Relationships on a deliberately unprojected resource type — `survey`, `dashboard`, `response`.
   *
   * Expected to be 0, and structurally so: every read this tool issues filters to a managed type, so
   * there is no path by which an unprojected type is observed. The classification behind it is kept
   * anyway, because it is what guarantees that widening a filter later cannot make a survey relationship
   * look like an orphan and prune it. A non-zero value means a filter was widened without revisiting
   * that, which is worth seeing rather than silently absorbing.
   */
  ignored: number;
  invalid: number;
  /** Resources attached to an organization PostgreSQL says does not own them. Never pruned. */
  mismatchedParents: number;
  /** Source records PostgreSQL holds that SpiceDB has no relationship for. */
  missing: number;
  orphaned: number;
  pruned: number;
  reconciled: number;
  scanned: number;
  skipped: number;
  /**
   * Relationships outside the vocabulary, counted rather than merely listed.
   *
   * The `unmanaged` list is capped for output size, so the count is what the status can be computed from.
   */
  unmanaged: number;
}>;

export type TAuthzedBackfillFailure = Readonly<{
  /**
   * How many attempts stood behind this failure.
   *
   * Carried because the commands run at `LOG_LEVEL=fatal` to keep stdout a single JSON line, so this
   * object is the operator's only diagnostic. Without it, "failed once" and "exhausted the retry
   * budget" — a blip versus an outage — are indistinguishable in the report.
   */
  attempts: number;
  code: string;
  organizationId: string;
  retryable: boolean;
}>;

export type TAuthzedBackfillResult = Readonly<{
  /**
   * A revision SpiceDB was at *after* this run finished writing, or `null`.
   *
   * Captured by one read issued once all work is done, so it genuinely post-dates the run's own writes
   * and can serve as an `at_least_as_fresh` floor for shadow evaluation. Taking it from the observation
   * reads instead would have pre-dated them, which is the opposite of a freshness floor.
   *
   * `null` for a dry run (nothing was written, so there is nothing to be fresh relative to), for an empty
   * store, and if the closing read fails — never a stale value dressed up as a fresh one.
   */
  completedAtSnapshot: string | null;
  counters: TAuthzedBackfillCounters;
  failures: ReadonlyArray<TAuthzedBackfillFailure>;
  lastOrganizationId: string | null;
  /**
   * Parent edges PostgreSQL contradicts.
   *
   * Reported and never touched. A cross-tenant parent edge is a privilege escalation, but removing it
   * safely means deleting a relation the resource legitimately needs one of, so it is deliberately left
   * for a human — see the runbook.
   */
  mismatchedParents: ReadonlyArray<TAuthzedParentEdge>;
  mode: "apply" | "dry_run";
  orphanScope: "all" | "known_resources";
  orphans: ReadonlyArray<TAuthzedSourceRef>;
  scope: "all" | "organization" | "workspace";
  status: "drifted" | "failed" | "reconciled";
  /**
   * Set when the counters are not exact. Either way, re-run before concluding anything.
   *
   * Two causes, and they err in opposite directions, so neither "floor" nor "total" describes the
   * counts on its own:
   *
   * - **an observation was abandoned** mid-read, so fewer relationships were seen than exist and the
   *   counts are a floor. Fail-safe for pruning: fewer orphans found means fewer deleted.
   * - **the sweep's deduplication bound was exceeded**, so a record implied by two pages beyond that
   *   point is counted twice and the counts may over-report. Also safe, because a run with that many
   *   orphans is orders of magnitude past the prune cap and so deletes nothing.
   *
   * Deliberately narrow in one respect: it does *not* mean the `orphans` / `failures` /
   * `mismatchedParents` lists hit their reporting cap. Those stay capped at 100 entries with the
   * counters carrying the true totals, and conflating the two would make a merely-verbose run look like
   * an incomplete one — which matters, because this flag forces a non-clean status.
   */
  truncated: boolean;
  unmanaged: ReadonlyArray<Readonly<{ objectId: string; objectType: string; relation: string }>>;
}>;

/** Entries reported individually before the list is capped and only counters remain accurate. */
const MAX_REPORTED_ENTRIES = 100;

const toErrorCode = (error: unknown): Readonly<{ attempts: number; code: string; retryable: boolean }> =>
  error instanceof AuthzedError
    ? { attempts: error.attempts, code: error.code, retryable: error.retryable }
    : { attempts: 1, code: "authzed_internal", retryable: false };

/** The seven target lists the three reconcilers accept between them. */
type TReconcileTargets = Readonly<{
  apiKeyIds: ReadonlyArray<string>;
  apiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  memberships: ReadonlyArray<TAuthzedMembershipTarget>;
  teamIds: ReadonlyArray<string>;
  teamMemberships: ReadonlyArray<TAuthzedTeamMembershipTarget>;
  workspaceIds: ReadonlyArray<string>;
  workspaceTeamGrants: ReadonlyArray<TAuthzedWorkspaceTeamTarget>;
}>;

/**
 * Turn missing source records into reconciler targets.
 *
 * A record PostgreSQL does not hold becomes a *target*, never a delete instruction. The reconciler
 * re-reads PostgreSQL and decides, so a record recreated between the observation and the reconcile is
 * written rather than deleted — the race resolves toward granting access, not revoking it. That
 * indirection is the core reason repair is safe.
 */
const toRepairTargets = (refs: ReadonlyArray<TAuthzedSourceRef>): TReconcileTargets => {
  const apiKeyIds: string[] = [];
  const apiKeyWorkspaceGrants: TAuthzedApiKeyWorkspaceTarget[] = [];
  const memberships: TAuthzedMembershipTarget[] = [];
  const teamIds: string[] = [];
  const teamMemberships: TAuthzedTeamMembershipTarget[] = [];
  const workspaceIds: string[] = [];
  const workspaceTeamGrants: TAuthzedWorkspaceTeamTarget[] = [];

  for (const ref of refs) {
    switch (ref.kind) {
      case "apiKey":
        apiKeyIds.push(ref.apiKeyId);
        break;
      case "apiKeyWorkspaceGrant":
        apiKeyWorkspaceGrants.push({ apiKeyId: ref.apiKeyId, workspaceId: ref.workspaceId });
        break;
      case "membership":
        memberships.push({ organizationId: ref.organizationId, userId: ref.userId });
        break;
      case "team":
        teamIds.push(ref.teamId);
        break;
      case "teamMembership":
        teamMemberships.push({ teamId: ref.teamId, userId: ref.userId });
        break;
      case "workspace":
        workspaceIds.push(ref.workspaceId);
        break;
      case "workspaceTeamGrant":
        workspaceTeamGrants.push({ teamId: ref.teamId, workspaceId: ref.workspaceId });
        break;
    }
  }

  return {
    apiKeyIds,
    apiKeyWorkspaceGrants,
    memberships,
    teamIds,
    teamMemberships,
    workspaceIds,
    workspaceTeamGrants,
  };
};

/**
 * The source records an organization holds, in the same vocabulary an observation produces.
 *
 * Lets the two sides be compared with a set difference, which is what makes a dry run able to report the
 * PostgreSQL-to-SpiceDB direction at all.
 */
const toSourceRefs = (source: TAuthzedOrganizationSource): ReadonlyArray<TAuthzedSourceRef> => [
  ...source.memberships.map(
    ({ organizationId, userId }): TAuthzedSourceRef => ({ kind: "membership", organizationId, userId })
  ),
  ...source.teamIds.map((teamId): TAuthzedSourceRef => ({ kind: "team", teamId })),
  ...source.teamMemberships.map(
    ({ teamId, userId }): TAuthzedSourceRef => ({ kind: "teamMembership", teamId, userId })
  ),
  ...source.workspaceIds.map((workspaceId): TAuthzedSourceRef => ({ kind: "workspace", workspaceId })),
  ...source.workspaceTeamGrants.map(
    ({ teamId, workspaceId }): TAuthzedSourceRef => ({ kind: "workspaceTeamGrant", teamId, workspaceId })
  ),
  ...source.apiKeyIds.map((apiKeyId): TAuthzedSourceRef => ({ apiKeyId, kind: "apiKey" })),
  ...source.apiKeyWorkspaceGrants.map(
    ({ apiKeyId, workspaceId }): TAuthzedSourceRef => ({
      apiKeyId,
      kind: "apiKeyWorkspaceGrant",
      workspaceId,
    })
  ),
];

const mergeTargets = (left: TReconcileTargets, right: TReconcileTargets): TReconcileTargets => ({
  apiKeyIds: [...left.apiKeyIds, ...right.apiKeyIds],
  apiKeyWorkspaceGrants: [...left.apiKeyWorkspaceGrants, ...right.apiKeyWorkspaceGrants],
  memberships: [...left.memberships, ...right.memberships],
  teamIds: [...left.teamIds, ...right.teamIds],
  teamMemberships: [...left.teamMemberships, ...right.teamMemberships],
  workspaceIds: [...left.workspaceIds, ...right.workspaceIds],
  workspaceTeamGrants: [...left.workspaceTeamGrants, ...right.workspaceTeamGrants],
});

/**
 * Run one reconciler over chunked targets, stopping at the first chunk that does not project.
 *
 * A reconciler accepts several target lists at once and reads one PostgreSQL snapshot covering all of
 * them, so every list it understands is passed in a single call. Splitting them would multiply the
 * snapshot reads and the verification passes for no benefit.
 *
 * Chunking bounds each list independently, because each becomes its own `OR` clause in the snapshot
 * query. Call *i* takes chunk *i* of every list, so the number of calls is set by the longest list
 * rather than by their total.
 *
 * Returns `null` when every list was empty, so nothing reaches a reconciler — the write facade rejects
 * an empty update batch.
 */
const runChunked = async <TTargets extends Readonly<Record<string, ReadonlyArray<unknown>>>>(
  reconcile: (targets: TTargets) => Promise<TAuthzedProjectionResult>,
  targets: TTargets
): Promise<TAuthzedProjectionResult | null> => {
  type TEntry = readonly [keyof TTargets & string, ReadonlyArray<unknown>];
  const entries = (Object.entries(targets) as ReadonlyArray<TEntry>).filter(([, items]) => items.length > 0);
  if (entries.length === 0) {
    return null;
  }

  const chunkCount = Math.max(
    ...entries.map(([, items]) => Math.ceil(items.length / AUTHZED_BACKFILL_TARGET_CHUNK_SIZE))
  );

  for (let index = 0; index < chunkCount; index++) {
    const start = index * AUTHZED_BACKFILL_TARGET_CHUNK_SIZE;
    // Built by narrowing a full target object rather than assembling a partial one and asserting the
    // type. Every field of the reconcilers' target types is optional, so an assertion would silently
    // keep compiling if one ever became required — and the missing list would only surface at runtime.
    const chunkTargets: TTargets = { ...targets };
    for (const [key, items] of entries) {
      (chunkTargets as Record<string, ReadonlyArray<unknown>>)[key] = items.slice(
        start,
        start + AUTHZED_BACKFILL_TARGET_CHUNK_SIZE
      );
    }

    const result = await reconcile(chunkTargets);
    if (result.status !== "projected") {
      return result;
    }
  }

  return { passes: 1, status: "projected" };
};

/**
 * Reconcile every target list, reporting the first reconciler that did not project.
 *
 * One call per reconciler rather than one per list: each reads a single snapshot covering everything it
 * was given, so this is three snapshot reads for an organization instead of seven.
 *
 * `runBestEffortProjection` never throws; a reconciler hands back `{ status: "failed" }` instead. That
 * is what gives per-unit isolation for free, since one organization's AuthZed outage cannot abort the
 * sweep. `"disabled"` counts as a failure rather than a success — otherwise a run against an instance
 * with AuthZed switched off would report every organization as reconciled.
 */
const reconcileTargets = async (
  apply: TAuthzedBackfillApply,
  targets: TReconcileTargets
): Promise<TAuthzedProjectionResult | undefined> => {
  // Stops at the first reconciler that does not project. Continuing would spend two more three-attempt
  // retry budgets against an instance already known to be unreachable, and the unit is failed either way.
  const steps = [
    () => runChunked(apply.reconcileMemberships, { memberships: targets.memberships }),
    () =>
      runChunked(apply.reconcileTeamWorkspace, {
        teamIds: targets.teamIds,
        teamMemberships: targets.teamMemberships,
        workspaceIds: targets.workspaceIds,
        workspaceTeamGrants: targets.workspaceTeamGrants,
      }),
    () =>
      runChunked(apply.reconcileApiKeys, {
        apiKeyIds: targets.apiKeyIds,
        apiKeyWorkspaceGrants: targets.apiKeyWorkspaceGrants,
      }),
  ];

  for (const step of steps) {
    const outcome = await step();
    if (outcome !== null && outcome.status !== "projected") {
      return outcome;
    }
  }

  return undefined;
};

/**
 * Observe the relationships on one organization's own resources.
 *
 * Bounded to resources PostgreSQL still knows about, because SpiceDB relationship filters have no
 * notion of "belongs to organization X" and Formbricks object IDs carry no organization prefix. A
 * resource whose row is already gone is therefore unreachable from its organization, which is why
 * single-organization repair reports `orphanScope: "known_resources"` and only a full sweep can claim
 * completeness.
 */
const observeOrganizationResources = async (
  client: Pick<TAuthzedClient, "readRelationships">,
  organizationId: string,
  source: TAuthzedOrganizationSource
): Promise<Readonly<{ relationships: ReadonlyArray<TAuthzedRelationship>; snapshot: string | null }>> => {
  const filters = [
    { resourceId: organizationId, resourceType: "organization" },
    ...source.teamIds.map((teamId) => ({ resourceId: teamId, resourceType: "team" })),
    ...source.workspaceIds.map((workspaceId) => ({ resourceId: workspaceId, resourceType: "workspace" })),
    ...source.apiKeyIds.map((apiKeyId) => ({ resourceId: apiKeyId, resourceType: "api_key" })),
  ];

  const relationships: TAuthzedRelationship[] = [];
  let snapshot: string | null = null;

  // Bounded windows rather than one read at a time: an organization with many workspaces would
  // otherwise cost that many sequential round trips. The bound is the same one that caps parallel
  // relationship deletes, so this cannot outrun the connection budget the rest of the module assumes.
  //
  // Each filter resolves its own revision, which is fine: an observation is only ever used to name the
  // source record a relationship implies, and the reconciler re-reads PostgreSQL before acting on it.
  // Nothing here compares two resources against each other.
  for (let start = 0; start < filters.length; start += AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES) {
    const observations = await Promise.all(
      filters
        .slice(start, start + AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES)
        .map((filter) => readAllRelationships(client, filter))
    );

    for (const observation of observations) {
      relationships.push(...observation.relationships);
      snapshot = observation.snapshot?.token ?? snapshot;
    }
  }

  return { relationships, snapshot };
};

/**
 * One run's mutable tallies and capped report lists.
 *
 * Held in an explicit object rather than in closure variables so every unit of work can be a
 * module-level function. The orchestrator used to close over a dozen `let`s, which made it a single
 * function too large to reason about — and every defect found while reviewing this tool was in that
 * function.
 */
type TRunState = {
  completedAtSnapshot: string | null;
  failed: number;
  readonly failures: TAuthzedBackfillFailure[];
  ignored: number;
  invalid: number;
  lastOrganizationId: string | null;
  mismatchedParentCount: number;
  readonly mismatchedParents: TAuthzedParentEdge[];
  missingCount: number;
  orphaned: number;
  readonly orphans: TAuthzedSourceRef[];
  pruned: number;
  reconciled: number;
  scanned: number;
  skipped: number;
  truncated: boolean;
  readonly unmanaged: Array<Readonly<{ objectId: string; objectType: string; relation: string }>>;
  unmanagedCount: number;
};

const createRunState = (): TRunState => ({
  completedAtSnapshot: null,
  failed: 0,
  failures: [],
  ignored: 0,
  invalid: 0,
  lastOrganizationId: null,
  mismatchedParentCount: 0,
  mismatchedParents: [],
  missingCount: 0,
  orphaned: 0,
  orphans: [],
  pruned: 0,
  reconciled: 0,
  scanned: 0,
  skipped: 0,
  truncated: false,
  unmanaged: [],
  unmanagedCount: 0,
});

/** A unit of work's whole world: the run's tallies plus the configuration every unit shares. */
type TRunContext = Readonly<{
  apply: TAuthzedBackfillApply;
  client: Pick<TAuthzedClient, "readRelationships">;
  isPruning: boolean;
  maxPrune: number;
  mode: "apply" | "dry_run";
  /**
   * Whether a per-organization observation owns the orphan tallies.
   *
   * False only for a full scope, where the streamed sweep sees strictly more — counting on both paths
   * would report every stale relationship twice, and the default invocation is exactly that
   * combination (dry run, full scope).
   */
  ownsOrphanAccounting: boolean;
  sourceReads: TAuthzedBackfillSource;
  state: TRunState;
}>;

/** Append while honouring the reporting cap, so a run against a broken instance cannot emit a huge line. */
const pushCapped = <T>(list: T[], items: ReadonlyArray<T>): void => {
  list.push(...items.slice(0, Math.max(0, MAX_REPORTED_ENTRIES - list.length)));
};

const recordFailure = (state: TRunState, organizationId: string, error: unknown): void => {
  state.failed++;
  pushCapped(state.failures, [{ organizationId, ...toErrorCode(error) }]);
};

const recordProjectionFailure = (
  state: TRunState,
  organizationId: string,
  result: TAuthzedProjectionResult
): void => {
  state.failed++;
  pushCapped(state.failures, [
    result.status === "failed"
      ? { attempts: result.attempts, code: result.code, organizationId, retryable: result.retryable }
      : // `disabled` reaching here means AuthZed was switched off mid-run; nothing was attempted.
        { attempts: 0, code: "authzed_disabled", organizationId, retryable: false },
  ]);
};

const recordMismatchedParents = (state: TRunState, edges: ReadonlyArray<TAuthzedParentEdge>): void => {
  state.mismatchedParentCount += edges.length;
  pushCapped(state.mismatchedParents, edges);
};

/**
 * What a unit is permitted to prune.
 *
 * `overBudget` is carried separately rather than inferred from an empty `refs`, because "nothing to
 * prune" and "too much to prune safely" must lead to different decisions and an empty list cannot tell
 * them apart. The workspace scope depends on the difference: naming a workspace whose row is gone
 * deletes *every* relationship on it, so that target has to be withheld when the budget was exceeded.
 */
type TPruneDecision = Readonly<{
  overBudget: boolean;
  refs: ReadonlyArray<TAuthzedSourceRef>;
}>;

/**
 * Record the classification tallies an observation implies, and verify the organizations its resources
 * claim to belong to.
 *
 * Shared by all three observation paths — the two narrow scopes and each page of the sweep — because
 * this half is identical regardless of how the relationships were reached.
 */
const recordObservationSummary = async (
  ctx: TRunContext,
  summary: TAuthzedObservationSummary
): Promise<void> => {
  ctx.state.ignored += summary.ignored;
  ctx.state.unmanagedCount += summary.unmanaged.length;
  pushCapped(ctx.state.unmanaged, summary.unmanaged);
  recordMismatchedParents(ctx.state, await ctx.sourceReads.findMismatchedParentEdges(summary.parentEdges));
};

/**
 * Record the orphans a narrow-scope observation found, and decide which of them may be pruned.
 *
 * A count over the budget prunes *nothing* for that unit: a large orphan count is a symptom — wrong
 * endpoint, wrong database, a restore in progress — not a big cleanup job, so the run degrades into a
 * loud report instead of a partly-destroyed graph.
 *
 * The sweep deliberately does not use this. It streams, so it has to deduplicate across pages before it
 * can count, and it decides the budget against the whole sweep rather than against one unit.
 */
const recordScopedOrphans = async (
  ctx: TRunContext,
  summary: TAuthzedObservationSummary
): Promise<TPruneDecision> => {
  const missingRefs = await ctx.sourceReads.findMissingSourceRefs(summary.sourceRefs);
  ctx.state.orphaned += missingRefs.length;
  pushCapped(ctx.state.orphans, missingRefs);

  if (missingRefs.length > ctx.maxPrune) {
    ctx.state.skipped++;

    return { overBudget: true, refs: [] };
  }

  return { overBudget: false, refs: ctx.isPruning ? missingRefs : [] };
};

/**
 * Observe one organization's own resources and record what that implies.
 *
 * Returns the refs to hand a reconciler as repair targets. Throws if the observation could not be
 * completed, which the caller must treat as "this unit could not be observed" rather than as
 * "nothing stale here".
 */
const observeOrganization = async (
  ctx: TRunContext,
  organizationId: string,
  source: TAuthzedOrganizationSource
): Promise<TPruneDecision> => {
  const { state } = ctx;
  const observation = await observeOrganizationResources(ctx.client, organizationId, source);
  const summary = summarizeObservation(observation.relationships);

  if (ctx.mode === "dry_run") {
    // The direction an applying run converges by writing, and the only one a report can speak to.
    state.missingCount += findUnprojectedSourceRefs(toSourceRefs(source), summary.sourceRefs).length;
  }

  if (!ctx.ownsOrphanAccounting) {
    return { overBudget: false, refs: [] };
  }

  await recordObservationSummary(ctx, summary);

  return recordScopedOrphans(ctx, summary);
};

const processOrganization = async (ctx: TRunContext, organizationId: string): Promise<void> => {
  const { state } = ctx;
  state.scanned++;
  state.lastOrganizationId = organizationId;

  let source: TAuthzedOrganizationSource;
  try {
    source = await ctx.sourceReads.readOrganizationSource(organizationId);
  } catch (error) {
    recordFailure(state, organizationId, error);

    return;
  }

  state.invalid += source.invalidWorkspaceTeamGrants.length + source.invalidApiKeyWorkspaceGrants.length;

  // Observed for two reasons with different owners: a narrow scope owns everything it finds, while a
  // full scope observes only to compute the direction the sweep cannot — records PostgreSQL holds that
  // SpiceDB is missing. An applying full scope skips it entirely, since its writes converge that
  // direction anyway and a read per resource to report what is about to be fixed is waste.
  let repairRefs: ReadonlyArray<TAuthzedSourceRef> = [];
  if (ctx.ownsOrphanAccounting || ctx.mode === "dry_run") {
    try {
      repairRefs = (await observeOrganization(ctx, organizationId, source)).refs;
    } catch (error) {
      // An abandoned observation must never be reported as a complete one: fewer relationships seen
      // means fewer orphans found, and a caller could otherwise read that as "nothing stale here".
      state.truncated = true;
      recordFailure(state, organizationId, error);

      return;
    }
  }

  if (ctx.mode === "dry_run") {
    return;
  }

  const failure = await reconcileTargets(
    ctx.apply,
    mergeTargets(
      {
        apiKeyIds: source.apiKeyIds,
        apiKeyWorkspaceGrants: source.apiKeyWorkspaceGrants,
        memberships: source.memberships,
        teamIds: source.teamIds,
        teamMemberships: source.teamMemberships,
        workspaceIds: source.workspaceIds,
        workspaceTeamGrants: source.workspaceTeamGrants,
      },
      toRepairTargets(repairRefs)
    )
  );

  if (failure) {
    recordProjectionFailure(state, organizationId, failure);

    return;
  }

  // Counted here rather than at detection time so a failed reconcile cannot report relationships as
  // pruned that are still present.
  state.pruned += repairRefs.length;
  state.reconciled++;
};

/**
 * Tally one page of the sweep, returning the orphans on it that no earlier page already reported.
 *
 * Deduplicated run-wide because each page is classified on its own, so one record can be implied by
 * relationships on two pages — across resource types (an API key is named by both
 * `api_key#organization` and `organization#api_key_reader`) and within one, since alternate relations
 * on the same resource come back grouped by relation rather than adjacently.
 */
const tallySweepPage = async (
  ctx: TRunContext,
  seenOrphanRefs: Set<string>,
  relationships: ReadonlyArray<TAuthzedRelationship>
): Promise<ReadonlyArray<TAuthzedSourceRef>> => {
  const { state } = ctx;
  const summary = summarizeObservation(relationships);
  await recordObservationSummary(ctx, summary);

  const fresh: TAuthzedSourceRef[] = [];
  for (const ref of await ctx.sourceReads.findMissingSourceRefs(summary.sourceRefs)) {
    const key = sourceRefKey(ref);
    if (seenOrphanRefs.has(key)) {
      continue;
    }
    if (seenOrphanRefs.size >= AUTHZED_MAX_TRACKED_ORPHAN_REFS) {
      // Past the bound the count may double-count. Say so rather than let the total read as exact.
      state.truncated = true;
    } else {
      seenOrphanRefs.add(key);
    }

    fresh.push(ref);
  }

  state.orphaned += fresh.length;
  pushCapped(state.orphans, fresh);

  return fresh;
};

/**
 * Sweep every managed resource type to find resources PostgreSQL no longer holds at all.
 *
 * Two phases, and the order is the safety property. The whole sweep is observed and counted first;
 * only then, and only if the confirmed total fits the budget, is anything deleted. Enforcing the cap
 * while streaming would delete every page that fit and halt on the one that did not — so a run aimed
 * at the wrong database would revoke a cap's worth of live access instead of revoking none, which
 * inverts what the cap is for.
 *
 * Streamed rather than drained: a resource type has no upper bound in a real deployment, so
 * accumulating one would hold the whole store in memory and trip the per-unit observation bound,
 * turning the only mode that can remove stale relationships into one that fails permanently on exactly
 * the deployments that need it. Only the prunable refs are accumulated, and the budget bounds those.
 */
const sweepGlobalOrphans = async (ctx: TRunContext): Promise<void> => {
  const { state } = ctx;
  // Bounded by the budget: past it nothing will be pruned anyway, so there is no reason to hold more.
  const prunable: TAuthzedSourceRef[] = [];
  const seenOrphanRefs = new Set<string>();
  let sweepOrphans = 0;

  for (const resourceType of getManagedResourceTypes()) {
    await forEachRelationshipPage(ctx.client, { resourceType }, async (relationships) => {
      const fresh = await tallySweepPage(ctx, seenOrphanRefs, relationships);
      sweepOrphans += fresh.length;
      // Bounded by the prune budget, *not* by the reporting cap: `pushCapped` would silently stop at
      // 100 and under-prune a run that is entirely within its budget.
      prunable.push(...fresh.slice(0, Math.max(0, ctx.maxPrune - prunable.length)));
    });
  }

  if (!ctx.isPruning || sweepOrphans === 0) {
    return;
  }

  if (sweepOrphans > ctx.maxPrune) {
    // Nothing has been deleted yet, and nothing will be.
    state.skipped++;

    return;
  }

  const failure = await reconcileTargets(ctx.apply, toRepairTargets(prunable));
  if (failure) {
    // Attributed to no organization: a fully orphaned resource has none left to attribute it to.
    recordProjectionFailure(state, "", failure);

    return;
  }

  state.pruned += prunable.length;
};

/** The source records a workspace's own relationships should cover, when its row still exists. */
const toWorkspaceSourceRefs = (
  source: TAuthzedWorkspaceSource,
  workspaceId: string
): ReadonlyArray<TAuthzedSourceRef> => {
  // Only the grants are compared: whether the workspace's own parent edge exists is decided by
  // `workspaceExists`, and a workspace with no row should have no relationships at all.
  if (!source.workspaceExists) {
    return [];
  }

  return [
    ...source.workspaceTeamGrants.map(
      ({ teamId, workspaceId: grantWorkspaceId }): TAuthzedSourceRef => ({
        kind: "workspaceTeamGrant",
        teamId,
        workspaceId: grantWorkspaceId,
      })
    ),
    ...source.apiKeyWorkspaceGrants.map(
      ({ apiKeyId, workspaceId: grantWorkspaceId }): TAuthzedSourceRef => ({
        apiKeyId,
        kind: "apiKeyWorkspaceGrant",
        workspaceId: grantWorkspaceId,
      })
    ),
    { kind: "workspace", workspaceId },
  ];
};

const observeWorkspace = async (
  ctx: TRunContext,
  workspaceId: string,
  source: TAuthzedWorkspaceSource
): Promise<TPruneDecision> => {
  const observation = await readAllRelationships(ctx.client, {
    resourceId: workspaceId,
    resourceType: "workspace",
  });
  const summary = summarizeObservation(observation.relationships);
  await recordObservationSummary(ctx, summary);

  if (ctx.mode === "dry_run") {
    // Dry run only. An applying run converges this direction by writing, so counting it beforehand would
    // leave a successful repair reporting `drifted` and exiting 2 on the strength of a pre-write reading.
    ctx.state.missingCount += findUnprojectedSourceRefs(
      toWorkspaceSourceRefs(source, workspaceId),
      summary.sourceRefs
    ).length;
  }

  return recordScopedOrphans(ctx, summary);
};

/**
 * Drop prune targets whose deletion would reach outside the named workspace.
 *
 * A grant ref implies its principal — `normalizeTargets` in both reconcilers adds the team or API key a
 * grant names — and when that principal has no PostgreSQL row the reconciler deletes subject-wide: every
 * workspace relationship for that team, or every organization *and* workspace relationship for that key.
 * One in-budget orphan on this workspace would therefore delete relationships in other tenants, none of
 * them counted against `pruned` or weighed against the cap.
 *
 * That fan-out is correct convergence — those relationships genuinely should go — but it is the
 * organization or full sweep's unit of work, not this one's. Here the ref stays counted in `orphaned` and
 * is withheld, so the run finishes `drifted` and tells the operator a wider scope is needed.
 */
const withinWorkspaceScope = async (
  ctx: TRunContext,
  refs: ReadonlyArray<TAuthzedSourceRef>
): Promise<ReadonlyArray<TAuthzedSourceRef>> => {
  const principalFor = (ref: TAuthzedSourceRef): TAuthzedSourceRef | null => {
    if (ref.kind === "workspaceTeamGrant") {
      return { kind: "team", teamId: ref.teamId };
    }
    if (ref.kind === "apiKeyWorkspaceGrant") {
      return { apiKeyId: ref.apiKeyId, kind: "apiKey" };
    }

    return null;
  };

  const principals = refs.map(principalFor).filter((ref): ref is TAuthzedSourceRef => ref !== null);
  if (principals.length === 0) {
    return refs;
  }

  const missing = new Set(
    (await ctx.sourceReads.findMissingSourceRefs(principals)).map((ref) => sourceRefKey(ref))
  );

  return refs.filter((ref) => {
    const principal = principalFor(ref);

    return principal === null || !missing.has(sourceRefKey(principal));
  });
};

/**
 * Reconcile one workspace's grants.
 *
 * The narrowest unit available, and unlike an organization it does not have to exist: a workspace whose
 * row is gone is the case most worth repairing, and its relationships are reachable from the ID the
 * caller supplied.
 *
 * Narrow, but not hermetic. The API keys holding grants on this workspace are reconciled in full, which
 * covers every *other* workspace those keys hold too — a key is reconciled as a unit, and splitting it
 * would mean writing a second, narrower implementation of the same convergence. Everything that reaches
 * that way is convergent: it writes what PostgreSQL says.
 *
 * Deletion is held to the stated scope separately, by `withinWorkspaceScope`. Without it a grant whose
 * principal had been deleted would make the reconciler delete subject-wide, reaching other tenants on the
 * strength of one orphan here — see that function for why those cases are deferred instead.
 */
const processWorkspace = async (ctx: TRunContext, workspaceId: string): Promise<void> => {
  const { state } = ctx;
  state.scanned++;

  let source: TAuthzedWorkspaceSource;
  try {
    source = await ctx.sourceReads.readWorkspaceSource(workspaceId);
  } catch (error) {
    // No organization to attribute this to: the read that would have told us which one failed.
    recordFailure(state, "", error);

    return;
  }

  // Attributed to the owning tenant where PostgreSQL knows one. The empty string is also the sweep's
  // marker for an orphan with no organization left, so a workspace that still has a row must not
  // report it.
  const failureOrganizationId = source.organizationId ?? "";

  state.invalid += source.invalidWorkspaceTeamGrants.length + source.invalidApiKeyWorkspaceGrants.length;

  // Declared without a value, like `source` above: the `catch` returns, so an initializer here would be
  // dead — and a dead initializer on a prune decision is worse than noise, since it reads as a safe
  // default that nothing actually falls back to.
  let decision: TPruneDecision;
  try {
    const observed = await observeWorkspace(ctx, workspaceId, source);
    decision = { ...observed, refs: await withinWorkspaceScope(ctx, observed.refs) };
  } catch (error) {
    state.truncated = true;
    recordFailure(state, failureOrganizationId, error);

    return;
  }

  if (ctx.mode === "dry_run") {
    return;
  }

  const failure = await reconcileTargets(
    ctx.apply,
    mergeTargets(
      {
        apiKeyIds: [],
        apiKeyWorkspaceGrants: source.apiKeyWorkspaceGrants,
        memberships: [],
        teamIds: [],
        teamMemberships: [],
        // Naming the workspace projects its parent edge when the row exists, and removes *every*
        // relationship on it when the row does not — team grants and API-key grants included. That
        // second case is a prune by the definition on `TAuthzedBackfillRequest`: reconciling a record
        // observed only in SpiceDB. So it needs the same permission, budget and accounting as any other
        // prune, rather than happening as a side effect of naming a stale ID with `--apply`.
        //
        // `overBudget` is load-bearing here, not decoration: without it an over-cap unit would report
        // `skipped: 1, pruned: 0` and still perform the widest deletion available on that workspace,
        // which inverts what the cap is for.
        workspaceIds: source.workspaceExists || (ctx.isPruning && !decision.overBudget) ? [workspaceId] : [],
        workspaceTeamGrants: source.workspaceTeamGrants,
      },
      toRepairTargets(decision.refs)
    )
  );

  if (failure) {
    recordProjectionFailure(state, failureOrganizationId, failure);

    return;
  }

  state.pruned += decision.refs.length;
  state.reconciled++;
};

/** Walk every organization by keyset page. */
const enumerateOrganizations = async (ctx: TRunContext, afterOrganizationId?: string): Promise<void> => {
  let cursor = afterOrganizationId;

  for (;;) {
    let organizationIds: ReadonlyArray<string>;
    try {
      organizationIds = await ctx.sourceReads.readOrganizationIdPage({
        afterOrganizationId: cursor,
        limit: AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
      });
    } catch (error) {
      // Caught rather than propagated so the report survives. Letting this escape would replace the
      // whole result with a bare failure line, discarding `lastOrganizationId` — the only thing an
      // operator can resume a long sweep from.
      ctx.state.truncated = true;
      recordFailure(ctx.state, "", error);

      return;
    }

    if (organizationIds.length === 0) {
      return;
    }

    // Strictly sequential, and not only to avoid write contention: `lastOrganizationId` is the resume
    // cursor, so processing out of order would let a resume skip an organization that failed while a
    // later one succeeded.
    for (const organizationId of organizationIds) {
      await processOrganization(ctx, organizationId);
    }
    cursor = organizationIds.at(-1);
  }
};

const runScope = async (ctx: TRunContext, scope: TAuthzedBackfillScope): Promise<void> => {
  if (scope.kind === "workspace") {
    await processWorkspace(ctx, scope.workspaceId);

    return;
  }

  if (scope.kind === "organization") {
    if (!(await ctx.sourceReads.organizationExists(scope.organizationId))) {
      throw new AuthzedError({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.NOT_FOUND,
        operation: "backfill_scope",
        retryable: false,
      });
    }
    await processOrganization(ctx, scope.organizationId);

    return;
  }

  // The sweep runs even if enumeration broke off part way: it is independent of organization paging,
  // and it is the only thing that can find a resource no organization can reach.
  await enumerateOrganizations(ctx, scope.afterOrganizationId);
  try {
    await sweepGlobalOrphans(ctx);
  } catch (error) {
    ctx.state.truncated = true;
    recordFailure(ctx.state, "", error);
  }
};

/**
 * A revision read after all work, so it post-dates every write this run made and can serve as an
 * `at_least_as_fresh` floor. Any managed type answers: the revision is a property of the datastore,
 * not of the filter.
 */
const captureClosingSnapshot = async (ctx: TRunContext): Promise<string | null> => {
  try {
    const closing = await ctx.client.readRelationships({
      filter: { resourceType: "organization" },
      limit: 1,
    });

    return closing.snapshot?.token ?? null;
  } catch {
    // A freshness floor that might pre-date the writes is worse than none at all.
    return null;
  }
};

/**
 * A failure outranks drift, and only a run that found nothing outstanding is `reconciled`.
 *
 * Every category of *unrepaired* state counts, not just the ones this tool can fix. `missing` and
 * `mismatchedParents` matter as much as `orphaned` — without them a dry run over an empty SpiceDB would
 * report "reconciled", the exact state this tool exists to fix — and so do `invalid` and `unmanaged`,
 * which are deliberately left alone. A cross-organization source row or an unrecognized relationship is
 * still authorization state nothing accounts for, and a clean exit here is what gates shadow evaluation
 * and enforcement, so it must not be reachable while any of them remain.
 */
const toRunStatus = (state: TRunState): TAuthzedBackfillResult["status"] => {
  if (state.failed > 0) {
    return "failed";
  }

  const hasDrift =
    state.orphaned > state.pruned ||
    state.missingCount > 0 ||
    state.mismatchedParentCount > 0 ||
    state.invalid > 0 ||
    state.unmanagedCount > 0 ||
    state.truncated;

  return hasDrift ? "drifted" : "reconciled";
};

export const runAuthzedBackfill = async (
  request: TAuthzedBackfillRequest,
  dependencies: TAuthzedBackfillDependencies
): Promise<TAuthzedBackfillResult> => {
  const { apply, client, source: sourceReads = defaultBackfillSource } = dependencies;
  const state = createRunState();
  const ctx: TRunContext = {
    apply,
    client,
    isPruning: request.prune && request.mode === "apply",
    // Defence in depth: the parser already bounds this, but `runAuthzedBackfill` is exported and a
    // caller passing 0 would make an over-cap unit invisible in `status`.
    maxPrune: Math.max(1, Math.min(request.maxPrune, AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN)),
    mode: request.mode,
    ownsOrphanAccounting: request.scope.kind !== "all",
    sourceReads,
    state,
  };

  await runScope(ctx, request.scope);

  if (request.mode === "apply" && state.failed === 0) {
    state.completedAtSnapshot = await captureClosingSnapshot(ctx);
  }

  return {
    completedAtSnapshot: state.completedAtSnapshot,
    counters: {
      failed: state.failed,
      ignored: state.ignored,
      invalid: state.invalid,
      mismatchedParents: state.mismatchedParentCount,
      missing: state.missingCount,
      orphaned: state.orphaned,
      pruned: state.pruned,
      reconciled: state.reconciled,
      scanned: state.scanned,
      skipped: state.skipped,
      unmanaged: state.unmanagedCount,
    },
    failures: state.failures,
    lastOrganizationId: state.lastOrganizationId,
    mismatchedParents: state.mismatchedParents,
    mode: request.mode,
    orphanScope: request.scope.kind === "all" ? "all" : "known_resources",
    orphans: state.orphans,
    scope: request.scope.kind,
    status: toRunStatus(state),
    truncated: state.truncated,
    unmanaged: state.unmanaged,
  };
};
