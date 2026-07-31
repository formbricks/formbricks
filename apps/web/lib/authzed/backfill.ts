import "server-only";
import type { TApiKeyProjectionTargets } from "./api-key";
import {
  type TAuthzedParentEdge,
  type TAuthzedSourceRef,
  findUnprojectedSourceRefs,
  getManagedResourceTypes,
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
}>;

export type TAuthzedBackfillFailure = Readonly<{
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
   * Set when an observation was abandoned, so the counts are a floor rather than a total.
   *
   * Deliberately narrow: it does *not* mean the `orphans` / `failures` / `mismatchedParents` lists hit
   * their reporting cap. Those stay capped at 100 entries with the counters carrying the true totals,
   * and conflating the two would make a merely-verbose run look like an incomplete one — which matters,
   * because this flag forces a non-clean status.
   */
  truncated: boolean;
  unmanaged: ReadonlyArray<Readonly<{ objectId: string; objectType: string; relation: string }>>;
}>;

/** Entries reported individually before the list is capped and only counters remain accurate. */
const MAX_REPORTED_ENTRIES = 100;

const toErrorCode = (error: unknown): Readonly<{ code: string; retryable: boolean }> =>
  error instanceof AuthzedError
    ? { code: error.code, retryable: error.retryable }
    : { code: "authzed_internal", retryable: false };

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
 * Returns `null` when there was nothing to do, so an empty list never reaches a reconciler — the write
 * facade rejects an empty batch.
 *
 * `runBestEffortProjection` never throws; a reconciler hands back `{ status: "failed" }` instead. That
 * is what gives per-unit isolation for free, since one organization's AuthZed outage cannot abort the
 * sweep. `"disabled"` counts as a failure rather than a success — otherwise a run against an instance
 * with AuthZed switched off would report every organization as reconciled.
 */
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

export const runAuthzedBackfill = async (
  request: TAuthzedBackfillRequest,
  dependencies: TAuthzedBackfillDependencies
): Promise<TAuthzedBackfillResult> => {
  const { apply, client, source: sourceReads = defaultBackfillSource } = dependencies;
  const isPruning = request.prune && request.mode === "apply";
  // Defence in depth: the parser already bounds this, but `runAuthzedBackfill` is exported and a caller
  // passing 0 would make an over-cap unit invisible in `status`.
  const maxPrune = Math.max(1, Math.min(request.maxPrune, AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN));

  let failed = 0;
  let ignored = 0;
  let invalid = 0;
  let mismatchedParentCount = 0;
  let missingCount = 0;
  let orphaned = 0;
  let pruned = 0;
  let reconciled = 0;
  let scanned = 0;
  let skipped = 0;
  let truncated = false;
  let completedAtSnapshot: string | null = null;
  let lastOrganizationId: string | null = null;
  const failures: TAuthzedBackfillFailure[] = [];
  const orphans: TAuthzedSourceRef[] = [];
  const mismatchedParents: TAuthzedParentEdge[] = [];
  const unmanaged: Array<Readonly<{ objectId: string; objectType: string; relation: string }>> = [];

  const recordFailure = (organizationId: string, error: unknown): void => {
    failed++;
    if (failures.length < MAX_REPORTED_ENTRIES) {
      failures.push({ organizationId, ...toErrorCode(error) });
    }
  };

  const recordMismatchedParents = (edges: ReadonlyArray<TAuthzedParentEdge>): void => {
    mismatchedParentCount += edges.length;
    for (const edge of edges) {
      if (mismatchedParents.length < MAX_REPORTED_ENTRIES) {
        mismatchedParents.push(edge);
      }
    }
  };

  const recordProjectionFailure = (organizationId: string, result: TAuthzedProjectionResult): void => {
    failed++;
    if (failures.length < MAX_REPORTED_ENTRIES) {
      failures.push(
        result.status === "failed"
          ? { code: result.code, organizationId, retryable: result.retryable }
          : // `disabled` reaching here means AuthZed was switched off mid-run.
            { code: "authzed_disabled", organizationId, retryable: false }
      );
    }
  };

  const processOrganization = async (organizationId: string): Promise<void> => {
    scanned++;
    lastOrganizationId = organizationId;

    let source: TAuthzedOrganizationSource;
    try {
      source = await sourceReads.readOrganizationSource(organizationId);
    } catch (error) {
      recordFailure(organizationId, error);
      return;
    }

    invalid += source.invalidWorkspaceTeamGrants.length;

    // Two reasons to observe an organization's own resources, and they have different owners.
    //
    // A narrow scope has no global sweep behind it, so the observation owns everything it finds. A full
    // scope *does* have one, and the sweep sees strictly more — so here the observation exists only to
    // compute the direction the sweep cannot: records PostgreSQL holds that SpiceDB is missing. Counting
    // orphans on both paths would report every stale relationship twice, and the default invocation is
    // exactly that combination (dry run, full scope).
    //
    // An applying full scope skips the observation entirely: its writes converge the missing direction
    // anyway, and paying a read per resource to report what is about to be fixed is waste.
    const ownsOrphanAccounting = request.scope.kind !== "all";
    const needsMissingCheck = request.mode === "dry_run";
    let repairRefs: ReadonlyArray<TAuthzedSourceRef> = [];
    let prunableRefs: ReadonlyArray<TAuthzedSourceRef> = [];
    if (ownsOrphanAccounting || needsMissingCheck) {
      try {
        const observation = await observeOrganizationResources(client, organizationId, source);
        const summary = summarizeObservation(observation.relationships);

        if (needsMissingCheck) {
          // The direction an applying run converges by writing, and the only one a report can speak to.
          missingCount += findUnprojectedSourceRefs(toSourceRefs(source), summary.sourceRefs).length;
        }

        if (!ownsOrphanAccounting) {
          return;
        }

        ignored += summary.ignored;
        for (const ref of summary.unmanaged) {
          if (unmanaged.length < MAX_REPORTED_ENTRIES) {
            unmanaged.push(ref);
          }
        }

        recordMismatchedParents(await sourceReads.findMismatchedParentEdges(summary.parentEdges));

        const missingRefs = await sourceReads.findMissingSourceRefs(summary.sourceRefs);
        orphaned += missingRefs.length;
        for (const ref of missingRefs) {
          if (orphans.length < MAX_REPORTED_ENTRIES) {
            orphans.push(ref);
          }
        }

        if (missingRefs.length > maxPrune) {
          // A large orphan count is a symptom — wrong endpoint, wrong database, a restore in progress —
          // not a big cleanup job. Prune nothing for this unit so the run degrades into a loud report
          // instead of a partly-destroyed graph.
          skipped++;
        } else if (isPruning) {
          repairRefs = missingRefs;
          prunableRefs = missingRefs;
        }
      } catch (error) {
        // An abandoned observation must never be reported as a complete one: fewer relationships seen
        // means fewer orphans found, and a caller could otherwise read that as "nothing stale here".
        truncated = true;
        recordFailure(organizationId, error);
        return;
      }
    }

    if (request.mode === "dry_run") {
      return;
    }

    const failure = await reconcileTargets(
      apply,
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
      recordProjectionFailure(organizationId, failure);
      return;
    }

    // Counted here rather than at detection time so a failed reconcile cannot report relationships as
    // pruned that are still present.
    pruned += prunableRefs.length;
    reconciled++;
  };

  /** Sweep every managed resource type to find resources PostgreSQL no longer holds at all. */
  const sweepGlobalOrphans = async (): Promise<void> => {
    // Streamed page by page rather than drained. A resource type has no upper bound in a real
    // deployment, so accumulating one would hold the whole store in memory and — worse — trip the
    // per-unit observation bound, turning the only mode that can remove stale relationships into one
    // that fails permanently on exactly the deployments that need it.
    // Halting pruning is not the same as halting the sweep. Once the budget is spent — or a prune fails
    // — reading continues so the reported orphan total stays the *true* magnitude rather than wherever
    // the run happened to stop. That number is the whole diagnostic: "500 orphans" and "half a million"
    // call for very different reactions, and the second is what says you aimed at the wrong database.
    let pruningHalted = false;

    // Streaming means each page is classified on its own, so a record implied by relationships on two
    // different resource types would be counted twice. Exactly one kind is ambiguous that way: an API key
    // is named both by `api_key#organization` and by `organization#api_key_reader`. Deduplicating just
    // that kind keeps the counts honest without holding a key for every record in the store.
    const seenApiKeyRefs = new Set<string>();
    const dedupe = (refs: ReadonlyArray<TAuthzedSourceRef>): ReadonlyArray<TAuthzedSourceRef> =>
      refs.filter((ref) => {
        if (ref.kind !== "apiKey") {
          return true;
        }
        if (seenApiKeyRefs.has(ref.apiKeyId)) {
          return false;
        }
        seenApiKeyRefs.add(ref.apiKeyId);
        return true;
      });

    for (const resourceType of getManagedResourceTypes()) {
      await forEachRelationshipPage(client, { resourceType }, async (relationships) => {
        const summary = summarizeObservation(relationships);
        ignored += summary.ignored;
        unmanaged.push(...summary.unmanaged.slice(0, Math.max(0, MAX_REPORTED_ENTRIES - unmanaged.length)));

        recordMismatchedParents(await sourceReads.findMismatchedParentEdges(summary.parentEdges));

        const missingRefs = await sourceReads.findMissingSourceRefs(dedupe(summary.sourceRefs));
        orphaned += missingRefs.length;
        orphans.push(...missingRefs.slice(0, Math.max(0, MAX_REPORTED_ENTRIES - orphans.length)));

        if (pruningHalted || !isPruning || missingRefs.length === 0) {
          return;
        }

        // A run-wide budget, not a per-page one: once the total would exceed it nothing more is pruned,
        // rather than letting a page-sized slice through on every page.
        if (pruned + missingRefs.length > maxPrune) {
          pruningHalted = true;
          skipped++;
          return;
        }

        const failure = await reconcileTargets(apply, toRepairTargets(missingRefs));
        if (failure) {
          // Attributed to no organization: a fully orphaned resource has none left to attribute it to.
          recordProjectionFailure("", failure);
          pruningHalted = true;
          return;
        }

        pruned += missingRefs.length;
      });
    }
  };

  /**
   * Reconcile one workspace's grants without touching the rest of the tenant.
   *
   * The narrowest unit available, and unlike an organization it does not have to exist: a workspace
   * whose row is gone is the case most worth repairing, and its relationships are reachable from the ID
   * the caller supplied.
   */
  const processWorkspace = async (workspaceId: string): Promise<void> => {
    scanned++;

    let source: Awaited<ReturnType<typeof sourceReads.readWorkspaceSource>>;
    try {
      source = await sourceReads.readWorkspaceSource(workspaceId);
    } catch (error) {
      recordFailure("", error);
      return;
    }

    let repairRefs: ReadonlyArray<TAuthzedSourceRef> = [];
    let prunableWorkspaceRefs: ReadonlyArray<TAuthzedSourceRef> = [];
    try {
      const observation = await readAllRelationships(client, {
        resourceId: workspaceId,
        resourceType: "workspace",
      });
      const summary = summarizeObservation(observation.relationships);
      ignored += summary.ignored;
      unmanaged.push(...summary.unmanaged.slice(0, Math.max(0, MAX_REPORTED_ENTRIES - unmanaged.length)));

      recordMismatchedParents(await sourceReads.findMismatchedParentEdges(summary.parentEdges));

      // Only the grants are compared: whether the workspace's own parent edge exists is decided by
      // `workspaceExists` below, and a workspace with no row should have no relationships at all.
      const expected = source.workspaceExists
        ? [
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
            { kind: "workspace" as const, workspaceId },
          ]
        : [];
      missingCount += findUnprojectedSourceRefs(expected, summary.sourceRefs).length;

      const missingRefs = await sourceReads.findMissingSourceRefs(summary.sourceRefs);
      orphaned += missingRefs.length;
      orphans.push(...missingRefs.slice(0, Math.max(0, MAX_REPORTED_ENTRIES - orphans.length)));

      if (missingRefs.length > maxPrune) {
        skipped++;
      } else if (isPruning) {
        repairRefs = missingRefs;
        prunableWorkspaceRefs = missingRefs;
      }
    } catch (error) {
      truncated = true;
      recordFailure("", error);
      return;
    }

    if (request.mode === "dry_run") {
      return;
    }

    const failure = await reconcileTargets(
      apply,
      mergeTargets(
        {
          apiKeyIds: [],
          apiKeyWorkspaceGrants: source.apiKeyWorkspaceGrants,
          memberships: [],
          teamIds: [],
          teamMemberships: [],
          // Naming a workspace that no longer exists is what removes its relationships.
          workspaceIds: [workspaceId],
          workspaceTeamGrants: source.workspaceTeamGrants,
        },
        toRepairTargets(repairRefs)
      )
    );

    if (failure) {
      recordProjectionFailure("", failure);
      return;
    }

    pruned += prunableWorkspaceRefs.length;
    reconciled++;
  };

  if (request.scope.kind === "workspace") {
    await processWorkspace(request.scope.workspaceId);
  } else if (request.scope.kind === "organization") {
    const { organizationId } = request.scope;
    if (!(await sourceReads.organizationExists(organizationId))) {
      throw new AuthzedError({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.NOT_FOUND,
        operation: "backfill_scope",
        retryable: false,
      });
    }
    await processOrganization(organizationId);
  } else {
    let afterOrganizationId = request.scope.afterOrganizationId;
    for (;;) {
      let organizationIds: ReadonlyArray<string>;
      try {
        organizationIds = await sourceReads.readOrganizationIdPage({
          afterOrganizationId,
          limit: AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
        });
      } catch (error) {
        // Caught rather than propagated so the report survives. Letting this escape would replace the
        // whole result with a bare failure line, discarding `lastOrganizationId` — the only thing an
        // operator can resume a long sweep from.
        truncated = true;
        recordFailure("", error);
        break;
      }

      if (organizationIds.length === 0) {
        break;
      }

      // Strictly sequential, and not only to avoid write contention: `lastOrganizationId` is the resume
      // cursor, so processing out of order would let a resume skip an organization that failed while a
      // later one succeeded.
      for (const organizationId of organizationIds) {
        await processOrganization(organizationId);
      }
      afterOrganizationId = organizationIds.at(-1);
    }

    try {
      await sweepGlobalOrphans();
    } catch (error) {
      truncated = true;
      recordFailure("", error);
    }
  }

  // Taken last, so it post-dates every write this run made. Any managed type answers: the revision is a
  // property of the datastore, not of the filter.
  if (request.mode === "apply" && failed === 0) {
    try {
      const closing = await client.readRelationships({
        filter: { resourceType: "organization" },
        limit: 1,
      });
      completedAtSnapshot = closing.snapshot?.token ?? null;
    } catch {
      // A freshness floor that might pre-date the writes is worse than none at all.
      completedAtSnapshot = null;
    }
  }

  // `missing` and `mismatchedParents` matter as much as `orphaned` here: without them a dry run over an
  // empty SpiceDB would report "reconciled", which is the exact state this tool exists to fix.
  const hasDrift = orphaned > pruned || missingCount > 0 || mismatchedParentCount > 0 || truncated;
  const status = failed > 0 ? "failed" : hasDrift ? "drifted" : "reconciled";

  return {
    completedAtSnapshot,
    counters: {
      failed,
      ignored,
      invalid,
      mismatchedParents: mismatchedParentCount,
      missing: missingCount,
      orphaned,
      pruned,
      reconciled,
      scanned,
      skipped,
    },
    failures,
    lastOrganizationId,
    mismatchedParents,
    mode: request.mode,
    orphanScope: request.scope.kind === "all" ? "all" : "known_resources",
    orphans,
    scope: request.scope.kind,
    status,
    truncated,
    unmanaged,
  };
};
