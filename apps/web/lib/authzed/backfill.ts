import "server-only";
import type { TApiKeyProjectionTargets } from "./api-key";
import { type TAuthzedSourceRef, getManagedResourceTypes, summarizeObservation } from "./backfill-diff";
import {
  type TAuthzedApiKeyWorkspaceTarget,
  type TAuthzedMembershipTarget,
  type TAuthzedOrganizationSource,
  type TAuthzedTeamMembershipTarget,
  type TAuthzedWorkspaceTeamTarget,
  findMissingSourceRefs,
  organizationExists,
  readOrganizationIdPage,
  readOrganizationSource,
} from "./backfill-source";
import type { TAuthzedClient, TAuthzedRelationship } from "./client";
import {
  AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
  AUTHZED_BACKFILL_TARGET_CHUNK_SIZE,
  AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES,
} from "./constants";
import { AuthzedError } from "./errors";
import type { TOrganizationMembershipProjectionTargets } from "./organization-membership";
import type { TAuthzedProjectionResult } from "./projection";
import { readAllRelationships } from "./relationship-reads";
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
  | Readonly<{ kind: "organization"; organizationId: string }>;

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
  findMissingSourceRefs: (
    refs: ReadonlyArray<TAuthzedSourceRef>
  ) => Promise<ReadonlyArray<TAuthzedSourceRef>>;
  organizationExists: (organizationId: string) => Promise<boolean>;
  readOrganizationIdPage: (
    page: Readonly<{ afterOrganizationId?: string; limit?: number }>
  ) => Promise<ReadonlyArray<string>>;
  readOrganizationSource: (organizationId: string) => Promise<TAuthzedOrganizationSource>;
}>;

export const defaultBackfillSource: TAuthzedBackfillSource = {
  findMissingSourceRefs,
  organizationExists,
  readOrganizationIdPage,
  readOrganizationSource,
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
  completedAtSnapshot: string | null;
  counters: TAuthzedBackfillCounters;
  failures: ReadonlyArray<TAuthzedBackfillFailure>;
  lastOrganizationId: string | null;
  mode: "apply" | "dry_run";
  orphanScope: "all" | "known_resources";
  orphans: ReadonlyArray<TAuthzedSourceRef>;
  scope: "all" | "organization";
  status: "drifted" | "failed" | "reconciled";
  /** Set when any observation was abandoned, so the report must not be read as complete. */
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
  const entries = Object.entries(targets).filter(([, items]) => items.length > 0);
  if (entries.length === 0) {
    return null;
  }

  const chunkCount = Math.max(
    ...entries.map(([, items]) => Math.ceil(items.length / AUTHZED_BACKFILL_TARGET_CHUNK_SIZE))
  );

  for (let index = 0; index < chunkCount; index++) {
    const start = index * AUTHZED_BACKFILL_TARGET_CHUNK_SIZE;
    const chunkTargets = Object.fromEntries(
      entries
        .map(([key, items]) => [key, items.slice(start, start + AUTHZED_BACKFILL_TARGET_CHUNK_SIZE)])
        .filter(([, items]) => (items as ReadonlyArray<unknown>).length > 0)
    ) as TTargets;

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
  const outcomes = [
    await runChunked(apply.reconcileMemberships, { memberships: targets.memberships }),
    await runChunked(apply.reconcileTeamWorkspace, {
      teamIds: targets.teamIds,
      teamMemberships: targets.teamMemberships,
      workspaceIds: targets.workspaceIds,
      workspaceTeamGrants: targets.workspaceTeamGrants,
    }),
    await runChunked(apply.reconcileApiKeys, {
      apiKeyIds: targets.apiKeyIds,
      apiKeyWorkspaceGrants: targets.apiKeyWorkspaceGrants,
    }),
  ];

  return outcomes.find(
    (outcome): outcome is TAuthzedProjectionResult => outcome !== null && outcome.status !== "projected"
  );
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

  let failed = 0;
  let ignored = 0;
  let invalid = 0;
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
  const unmanaged: Array<Readonly<{ objectId: string; objectType: string; relation: string }>> = [];

  const recordFailure = (organizationId: string, error: unknown): void => {
    failed++;
    if (failures.length < MAX_REPORTED_ENTRIES) {
      failures.push({ organizationId, ...toErrorCode(error) });
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

    // Observation only matters for single-organization scope; a full sweep observes globally instead,
    // which strictly covers more.
    let repairRefs: ReadonlyArray<TAuthzedSourceRef> = [];
    if (request.scope.kind === "organization") {
      try {
        const observation = await observeOrganizationResources(client, organizationId, source);
        const summary = summarizeObservation(observation.relationships);
        ignored += summary.ignored;
        for (const ref of summary.unmanaged) {
          if (unmanaged.length < MAX_REPORTED_ENTRIES) {
            unmanaged.push(ref);
          }
        }
        completedAtSnapshot = observation.snapshot ?? completedAtSnapshot;

        const missing = await sourceReads.findMissingSourceRefs(summary.sourceRefs);
        orphaned += missing.length;
        for (const ref of missing) {
          if (orphans.length < MAX_REPORTED_ENTRIES) {
            orphans.push(ref);
          }
        }

        if (missing.length > request.maxPrune) {
          // A large orphan count is a symptom — wrong endpoint, wrong database, a restore in progress —
          // not a big cleanup job. Prune nothing for this unit so the run degrades into a loud report
          // instead of a partly-destroyed graph.
          skipped++;
        } else if (isPruning) {
          repairRefs = missing;
          pruned += missing.length;
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

    reconciled++;
  };

  /** Sweep every managed resource type to find resources PostgreSQL no longer holds at all. */
  const sweepGlobalOrphans = async (): Promise<void> => {
    const relationships: TAuthzedRelationship[] = [];

    for (const resourceType of getManagedResourceTypes()) {
      const observation = await readAllRelationships(client, { resourceType });
      relationships.push(...observation.relationships);
      completedAtSnapshot = observation.snapshot?.token ?? completedAtSnapshot;
    }

    const summary = summarizeObservation(relationships);
    ignored += summary.ignored;
    unmanaged.push(...summary.unmanaged.slice(0, MAX_REPORTED_ENTRIES - unmanaged.length));

    const missing = await sourceReads.findMissingSourceRefs(summary.sourceRefs);
    orphaned += missing.length;
    orphans.push(...missing.slice(0, MAX_REPORTED_ENTRIES - orphans.length));

    if (missing.length > request.maxPrune) {
      skipped++;
      return;
    }

    if (!isPruning) {
      return;
    }

    const failure = await reconcileTargets(apply, toRepairTargets(missing));
    if (failure) {
      // Attributed to no organization: a fully orphaned resource has none left to attribute it to.
      recordProjectionFailure("", failure);
      return;
    }

    pruned += missing.length;
  };

  if (request.scope.kind === "organization") {
    const { organizationId } = request.scope;
    if (!(await sourceReads.organizationExists(organizationId))) {
      throw new Error("Organization not found");
    }
    await processOrganization(organizationId);
  } else {
    let afterOrganizationId = request.scope.afterOrganizationId;
    for (;;) {
      const organizationIds = await sourceReads.readOrganizationIdPage({
        afterOrganizationId,
        limit: AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
      });
      if (organizationIds.length === 0) {
        break;
      }

      // Strictly sequential: concurrent writes to the same organization resource produce retryable
      // serialization conflicts against a small retry budget.
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

  const status = failed > 0 ? "failed" : orphaned > pruned || truncated ? "drifted" : "reconciled";

  return {
    completedAtSnapshot,
    counters: { failed, ignored, invalid, orphaned, pruned, reconciled, scanned, skipped },
    failures,
    lastOrganizationId,
    mode: request.mode,
    orphanScope: request.scope.kind === "all" ? "all" : "known_resources",
    orphans,
    scope: request.scope.kind,
    status,
    truncated,
    unmanaged,
  };
};
