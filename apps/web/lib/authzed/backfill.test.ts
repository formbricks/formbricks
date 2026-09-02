import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TAuthzedBackfillRequest, runAuthzedBackfill } from "./backfill";
import * as source from "./backfill-source";
import type { TAuthzedOrganizationSource } from "./backfill-source";
import {
  AUTHZED_MAX_RELATIONSHIP_READS,
  AUTHZED_MAX_TRACKED_ORPHAN_REFS,
  AUTHZED_TARGET_CHUNK_SIZE,
} from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

vi.mock("./backfill-source", () => ({
  findMismatchedParentEdges: vi.fn(),
  findMissingSourceRefs: vi.fn(),
  organizationExists: vi.fn(),
  readOrganizationIdPage: vi.fn(),
  readOrganizationSource: vi.fn(),
  readWorkspaceSource: vi.fn(),
}));

const apply = {
  deleteFeedbackDirectoryAssignmentResources: vi.fn(),
  reconcileApiKeys: vi.fn(),
  reconcileFeedbackDirectories: vi.fn(),
  reconcileMemberships: vi.fn(),
  reconcileTeamWorkspace: vi.fn(),
};
const readRelationships = vi.fn();
const dependencies = { apply, client: { readRelationships } };

const PROJECTED = { passes: 1, status: "projected" } as const;

// Annotated, so adding a field to the source type is a compile error here rather than a pile of
// `undefined.length` failures at runtime.
const emptySource: TAuthzedOrganizationSource = {
  apiKeyIds: [],
  apiKeyWorkspaceGrants: [],
  expectedRelationships: [],
  feedbackDirectoryAssignments: [],
  feedbackDirectoryIds: [],
  invalidApiKeyWorkspaceGrants: [],
  invalidFeedbackDirectoryAssignments: [],
  invalidWorkspaceTeamGrants: [],
  memberships: [],
  teamIds: [],
  teamMemberships: [],
  workspaceIds: [],
  workspaceTeamGrants: [],
};

const request = (overrides: Partial<TAuthzedBackfillRequest> = {}): TAuthzedBackfillRequest => ({
  maxPrune: 500,
  mode: "apply",
  prune: false,
  scope: { kind: "organization", organizationId: "org-1" },
  ...overrides,
});

const emptyPage = { cursor: null, relationships: [], snapshot: null };

beforeEach(() => {
  vi.clearAllMocks();
  apply.reconcileApiKeys.mockResolvedValue(PROJECTED);
  apply.deleteFeedbackDirectoryAssignmentResources.mockResolvedValue(PROJECTED);
  apply.reconcileFeedbackDirectories.mockResolvedValue(PROJECTED);
  apply.reconcileMemberships.mockResolvedValue(PROJECTED);
  apply.reconcileTeamWorkspace.mockResolvedValue(PROJECTED);
  readRelationships.mockResolvedValue(emptyPage);
  vi.mocked(source.organizationExists).mockResolvedValue(true);
  vi.mocked(source.readOrganizationSource).mockResolvedValue(emptySource);
  vi.mocked(source.findMissingSourceRefs).mockResolvedValue([]);
  vi.mocked(source.findMismatchedParentEdges).mockResolvedValue([]);
  vi.mocked(source.readWorkspaceSource).mockResolvedValue({
    apiKeyWorkspaceGrants: [],
    expectedRelationships: [],
    feedbackDirectoryAssignments: [],
    invalidApiKeyWorkspaceGrants: [],
    invalidFeedbackDirectoryAssignments: [],
    invalidWorkspaceTeamGrants: [],
    organizationId: "org-1",
    workspaceExists: true,
    workspaceTeamGrants: [],
  });
  vi.mocked(source.readOrganizationIdPage).mockResolvedValue([]);
});

describe("dry-run inertness", () => {
  test("performs no reconciliation in dry-run mode", async () => {
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      memberships: [{ organizationId: "org-1", userId: "user-1" }],
      teamIds: ["team-1"],
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run" }), dependencies);

    expect(apply.reconcileMemberships).not.toHaveBeenCalled();
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalled();
    expect(apply.reconcileApiKeys).not.toHaveBeenCalled();
    expect(result.mode).toBe("dry_run");
    expect(result.counters.reconciled).toBe(0);
    expect(result.counters.scanned).toBe(1);
  });

  test("never prunes in dry-run mode even when pruning is requested", async () => {
    vi.mocked(source.findMissingSourceRefs).mockResolvedValue([{ kind: "team", teamId: "ghost-team" }]);
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [
        {
          relation: "organization",
          resource: { objectId: "ghost-team", objectType: "team" },
          subject: { objectId: "org-1", objectType: "organization" },
        },
      ],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run", prune: true }), dependencies);

    expect(result.counters.orphaned).toBe(1);
    expect(result.counters.pruned).toBe(0);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalled();
  });

  test("cannot reach a mutation except through the injected capability", () => {
    // The structural guarantee behind dry-run inertness: the orchestrator has no import path to a
    // write. If this regresses, a dry run could mutate regardless of the mode flag — so the guarantee
    // is asserted against the source rather than inferred from a mock never being called.
    const moduleSource = readFileSync(new URL("./backfill.ts", import.meta.url), "utf8");

    // Type-only imports are erased at compile time and carry no capability, so only value imports of
    // the client facade and the reconcilers matter. An import clause contains no semicolon, so
    // `[^;]` safely spans a multi-line clause.
    const importsSomethingAtRuntime = (clause: string): boolean => {
      const trimmed = clause.trim();
      if (trimmed.startsWith("type ")) {
        return false;
      }
      const specifiers = /^\{([\s\S]*)\}$/.exec(trimmed);
      if (!specifiers) {
        return true; // default or namespace import
      }
      return specifiers[1]
        .split(",")
        .map((specifier) => specifier.trim())
        .filter(Boolean)
        .some((specifier) => !specifier.startsWith("type "));
    };

    const valueImports = [...moduleSource.matchAll(/^import\b([^;]*?)from "([^"]+)";/gm)]
      .filter(([, clause]) => importsSomethingAtRuntime(clause))
      .map(([, , path]) => path);

    // `getAuthzedClient` and every reconciler are reachable only through these modules, so verifying
    // none is imported at runtime is the whole guarantee.
    for (const mutationModule of ["./client", "./organization-membership", "./team-workspace", "./api-key"]) {
      expect(valueImports).not.toContain(mutationModule);
    }
  });
});

describe("per-unit failure isolation", () => {
  test("continues the sweep when one organization fails and reports it", async () => {
    vi.mocked(source.readOrganizationIdPage)
      .mockResolvedValueOnce(["org-1", "org-2", "org-3"])
      .mockResolvedValueOnce([]);
    vi.mocked(source.readOrganizationSource)
      .mockResolvedValueOnce({ ...emptySource, teamIds: ["team-1"] })
      .mockRejectedValueOnce(new Error("statement timeout"))
      .mockResolvedValueOnce({ ...emptySource, teamIds: ["team-3"] });

    const result = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(result.counters.scanned).toBe(3);
    expect(result.counters.reconciled).toBe(2);
    expect(result.counters.failed).toBe(1);
    expect(result.failures).toEqual([
      { attempts: 1, code: "authzed_internal", organizationId: "org-2", retryable: false },
    ]);
    expect(result.status).toBe("failed");
  });

  test("reports a reconciler failure against its organization without aborting", async () => {
    vi.mocked(source.readOrganizationIdPage)
      .mockResolvedValueOnce(["org-1", "org-2"])
      .mockResolvedValueOnce([]);
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["team-1"],
    });
    apply.reconcileTeamWorkspace
      .mockResolvedValueOnce({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        retryable: true,
        status: "failed",
      })
      .mockResolvedValue(PROJECTED);

    const result = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(result.counters.failed).toBe(1);
    expect(result.counters.reconciled).toBe(1);
    expect(result.failures[0]).toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      organizationId: "org-1",
      retryable: true,
    });
  });

  test("counts a disabled projection as a failure rather than a success", async () => {
    // Otherwise a run against an instance with AuthZed switched off would report every organization as
    // reconciled and exit clean.
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["team-1"],
    });
    apply.reconcileTeamWorkspace.mockResolvedValue({ status: "disabled" });

    const result = await runAuthzedBackfill(request(), dependencies);

    expect(result.counters.failed).toBe(1);
    expect(result.counters.reconciled).toBe(0);
    expect(result.failures[0]).toMatchObject({ code: AUTHZED_ERROR_CODES.DISABLED });
    expect(result.status).toBe("failed");
  });

  test("resumes from the last organization it reached", async () => {
    vi.mocked(source.readOrganizationIdPage)
      .mockResolvedValueOnce(["org-1", "org-2"])
      .mockResolvedValueOnce([]);

    const result = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(result.lastOrganizationId).toBe("org-2");
    expect(source.readOrganizationIdPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ afterOrganizationId: "org-2" })
    );
  });

  test("rejects a scope naming an organization that does not exist", async () => {
    vi.mocked(source.organizationExists).mockResolvedValue(false);

    await expect(runAuthzedBackfill(request(), dependencies)).rejects.toThrow(AUTHZED_ERROR_CODES.NOT_FOUND);
    expect(apply.reconcileMemberships).not.toHaveBeenCalled();
  });
});

describe("idempotency", () => {
  test("a second run over unchanged state reports no drift and identical counters", async () => {
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      memberships: [{ organizationId: "org-1", userId: "user-1" }],
    });
    // Converged state: SpiceDB holds the relationship the membership implies. Without this the run
    // rightly reports the record as unprojected — see the dry-run detection tests.
    const convergedPage = {
      cursor: null,
      relationships: [
        {
          relation: "owner",
          resource: { objectId: "org-1", objectType: "organization" },
          subject: { objectId: "user-1", objectType: "user" },
        },
      ],
      snapshot: { token: "revision-1" },
    };
    readRelationships.mockResolvedValue(convergedPage);

    const first = await runAuthzedBackfill(request(), dependencies);
    const second = await runAuthzedBackfill(request(), dependencies);

    expect(second).toEqual(first);
    expect(second.counters.orphaned).toBe(0);
    expect(second.status).toBe("reconciled");
  });
});

describe("detecting records SpiceDB is missing", () => {
  test("a dry run over an empty SpiceDB reports drift rather than a clean bill of health", async () => {
    // The whole reason this tool exists. Reporting "reconciled" here would let an operator satisfy the
    // documented pre-enforcement gate with a run that proved nothing.
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      apiKeyIds: ["key-1"],
      memberships: [{ organizationId: "org-1", userId: "user-1" }],
      teamIds: ["team-1"],
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run" }), dependencies);

    expect(result.counters.missing).toBe(3);
    expect(result.status).toBe("drifted");
  });

  test("reports nothing missing once every record is projected", async () => {
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["team-1"],
    });
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [
        {
          relation: "organization",
          resource: { objectId: "team-1", objectType: "team" },
          subject: { objectId: "org-1", objectType: "organization" },
        },
      ],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run" }), dependencies);

    expect(result.counters.missing).toBe(0);
    expect(result.status).toBe("reconciled");
  });

  test("checks the missing direction on a full sweep only when nothing will be written", async () => {
    vi.mocked(source.readOrganizationIdPage).mockResolvedValueOnce(["org-1"]).mockResolvedValue([]);
    vi.mocked(source.readOrganizationSource).mockResolvedValue({ ...emptySource, teamIds: ["team-1"] });

    const dryRun = await runAuthzedBackfill(
      request({ mode: "dry_run", scope: { kind: "all" } }),
      dependencies
    );
    // An applying sweep converges this direction by writing, so it skips the per-organization read.
    const applied = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(dryRun.counters.missing).toBe(1);
    expect(applied.counters.missing).toBe(0);
  });
});

describe("counting each finding once", () => {
  const ghostTeam = {
    relation: "organization",
    resource: { objectId: "ghost-team", objectType: "team" },
    subject: { objectId: "org-1", objectType: "organization" },
  };

  beforeEach(() => {
    vi.mocked(source.readOrganizationIdPage).mockResolvedValueOnce(["org-1"]).mockResolvedValue([]);
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["ghost-team"],
    });
    // The orphan is reachable two ways: from org-1's own team list, and from the `team` type sweep.
    readRelationships.mockImplementation(({ filter }) =>
      Promise.resolve(
        filter.resourceType === "team"
          ? { cursor: null, relationships: [ghostTeam], snapshot: { token: "revision-1" } }
          : emptyPage
      )
    );
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) =>
      Promise.resolve(refs.filter((ref) => ref.kind === "team" && ref.teamId === "ghost-team"))
    );
  });

  test.each([
    ["the default run, which is a dry run over every organization", { kind: "all" } as const],
    ["a single organization", { kind: "organization", organizationId: "org-1" } as const],
  ])("counts one orphaned relationship once in %s", async (_label, scope) => {
    // A full scope observes per organization *and* sweeps globally. Only one of them may own the orphan
    // accounting, or every stale relationship is reported twice — and inflated counts both mislead an
    // operator and eat the prune budget twice over.
    const result = await runAuthzedBackfill(request({ mode: "dry_run", scope }), dependencies);

    expect(result.counters.orphaned).toBe(1);
  });

  test("still reports the missing direction on a full-scope dry run", async () => {
    // The whole reason the per-organization observation runs at all under a full scope.
    const result = await runAuthzedBackfill(
      request({ mode: "dry_run", scope: { kind: "all" } }),
      dependencies
    );

    expect(result.counters.missing).toBe(0);
    expect(result.status).toBe("drifted");
  });
});

describe("drift status covers unrepaired state", () => {
  test.each([
    [
      "a cross-organization source grant",
      () =>
        vi.mocked(source.readOrganizationSource).mockResolvedValue({
          ...emptySource,
          invalidWorkspaceTeamGrants: [{ teamId: "foreign-team", workspaceId: "ws-1" }],
        }),
    ],
    [
      "an unrecognized relationship",
      () =>
        readRelationships.mockResolvedValue({
          cursor: null,
          relationships: [
            {
              relation: "not_a_formbricks_relation",
              resource: { objectId: "org-1", objectType: "organization" },
              subject: { objectId: "someone", objectType: "user" },
            },
          ],
          snapshot: { token: "revision-1" },
        }),
    ],
  ])("does not report reconciled while %s remains", async (_label, arrange) => {
    // Both are deliberately left unrepaired — which is exactly why a clean exit must not be reachable
    // while they exist. This result is the gate for shadow evaluation and enforcement.
    arrange();

    const result = await runAuthzedBackfill(request(), dependencies);

    expect(result.status).toBe("drifted");
  });
});

describe("detecting a cross-tenant parent edge", () => {
  const foreignParent = {
    relation: "organization",
    resource: { objectId: "ws-1", objectType: "workspace" },
    subject: { objectId: "other-org", objectType: "organization" },
  };

  test("reports a parent edge PostgreSQL contradicts and never prunes it", async () => {
    // `organization` is a relation, so an extra parent edge is additive: every owner and manager of the
    // named organization gains access through `organization->manage`. Nothing in PostgreSQL shows it, and
    // an existence check cannot see it, because the workspace really does exist.
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [foreignParent],
      snapshot: { token: "revision-1" },
    });
    vi.mocked(source.findMismatchedParentEdges).mockResolvedValue([
      { childId: "ws-1", childType: "workspace", organizationId: "other-org", relation: "organization" },
    ]);

    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    expect(result.counters.mismatchedParents).toBe(1);
    expect(result.mismatchedParents).toEqual([
      { childId: "ws-1", childType: "workspace", organizationId: "other-org", relation: "organization" },
    ]);
    // Removing it would mean deleting a relation the workspace legitimately needs one of, so it is left
    // for a human — but it must force a non-clean status.
    expect(result.status).toBe("drifted");
    expect(result.counters.pruned).toBe(0);
  });
});

describe("detecting mismatched permission relations", () => {
  test("reports a stale higher workspace grant even though the source pair is present", async () => {
    const expectedRelationship = {
      relation: "reader_team",
      resource: { objectId: "ws-1", objectType: "workspace" },
      subject: { objectId: "team-1", objectType: "team", relation: "member" },
    };
    const observedRelationship = { ...expectedRelationship, relation: "manager_team" };
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      expectedRelationships: [expectedRelationship],
      workspaceIds: ["ws-1"],
      workspaceTeamGrants: [{ teamId: "team-1", workspaceId: "ws-1" }],
    });
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [observedRelationship],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run" }), dependencies);

    expect(result.counters.mismatchedPermissions).toBe(1);
    expect(result.mismatchedPermissions).toEqual([
      {
        expectedRelations: ["reader_team"],
        observedRelations: ["manager_team"],
        source: { kind: "workspaceTeamGrant", teamId: "team-1", workspaceId: "ws-1" },
      },
    ]);
    expect(result.status).toBe("drifted");
  });
});

describe("pruning", () => {
  const ghostTeamRelationship = {
    relation: "organization",
    resource: { objectId: "ghost-team", objectType: "team" },
    subject: { objectId: "org-1", objectType: "organization" },
  };

  beforeEach(() => {
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [ghostTeamRelationship],
      snapshot: { token: "revision-1" },
    });
    vi.mocked(source.findMissingSourceRefs).mockResolvedValue([{ kind: "team", teamId: "ghost-team" }]);
  });

  test("reports drift without pruning by default", async () => {
    const result = await runAuthzedBackfill(request(), dependencies);

    expect(result.counters.orphaned).toBe(1);
    expect(result.counters.pruned).toBe(0);
    expect(result.status).toBe("drifted");
    expect(result.orphans).toEqual([{ kind: "team", teamId: "ghost-team" }]);
    // The write half still runs, but the orphan is not handed to it.
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ teamIds: expect.arrayContaining(["ghost-team"]) })
    );
  });

  test("feeds the orphan to a reconciler as a target when pruning", async () => {
    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    expect(result.counters.pruned).toBe(1);
    expect(result.status).toBe("reconciled");
    // Handed over as a target, never as a delete instruction: the reconciler re-reads PostgreSQL and
    // decides, so a team recreated in the meantime is written rather than deleted.
    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ teamIds: ["ghost-team"] })
    );
  });

  test("prunes nothing for a unit whose orphan count exceeds the cap", async () => {
    vi.mocked(source.findMissingSourceRefs).mockResolvedValue([
      { kind: "team", teamId: "ghost-1" },
      { kind: "team", teamId: "ghost-2" },
    ]);

    const result = await runAuthzedBackfill(request({ maxPrune: 1, prune: true }), dependencies);

    // A large orphan count is a symptom, not a big cleanup job. Aborting before the first delete keeps
    // a misdirected run a loud report instead of a partly-destroyed graph.
    expect(result.counters.pruned).toBe(0);
    expect(result.counters.skipped).toBe(1);
    expect(result.status).toBe("drifted");
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ teamIds: expect.arrayContaining(["ghost-1"]) })
    );
  });

  test("marks the report incomplete when an observation is abandoned", async () => {
    readRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 1,
        code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
        operation: "read_relationships",
        retryable: false,
      })
    );

    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    // Fewer relationships observed means fewer orphans found, so the result must not read as complete.
    expect(result.truncated).toBe(true);
    expect(result.counters.pruned).toBe(0);
    expect(result.counters.failed).toBe(1);
    expect(result.failures[0]).toMatchObject({ code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION });
  });

  test("propagates a source-read failure instead of treating records as absent", async () => {
    vi.mocked(source.findMissingSourceRefs).mockRejectedValue(new Error("connection pool exhausted"));

    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    expect(result.counters.pruned).toBe(0);
    expect(result.counters.orphaned).toBe(0);
    expect(result.counters.failed).toBe(1);
    expect(result.truncated).toBe(true);
  });
});

describe("scope and observation completeness", () => {
  test("single-organization scope observes only resources PostgreSQL still knows about", async () => {
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      apiKeyIds: ["key-1"],
      teamIds: ["team-1"],
      workspaceIds: ["ws-1"],
    });

    const result = await runAuthzedBackfill(request(), dependencies);

    // A resource whose row is already gone is unreachable from its organization, so this scope must not
    // claim completeness.
    expect(result.orphanScope).toBe("known_resources");
    // The trailing organization read is the closing freshness capture, not an observation.
    expect(readRelationships.mock.calls.map(([query]) => query.filter)).toEqual([
      { resourceId: "org-1", resourceType: "organization" },
      { resourceId: "team-1", resourceType: "team" },
      { resourceId: "ws-1", resourceType: "workspace" },
      { resourceId: "key-1", resourceType: "api_key" },
      { resourceType: "organization" },
    ]);
  });

  test("full scope sweeps every managed resource type and claims completeness", async () => {
    vi.mocked(source.readOrganizationIdPage).mockResolvedValueOnce(["org-1"]).mockResolvedValueOnce([]);

    const result = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(result.orphanScope).toBe("all");
    expect(readRelationships.mock.calls.map(([query]) => query.filter)).toEqual([
      { resourceType: "api_key" },
      { resourceType: "feedback_directory" },
      { resourceType: "feedback_directory_assignment" },
      { resourceType: "organization" },
      { resourceType: "team" },
      { resourceType: "workspace" },
      // The closing freshness capture, which wants one relationship rather than a page.
      { resourceType: "organization" },
    ]);
    expect(
      readRelationships.mock.calls
        .slice(0, -1)
        .every(([query]) => query.limit === AUTHZED_MAX_RELATIONSHIP_READS)
    ).toBe(true);
  });

  test("reports a revision captured after the run's own writes", async () => {
    // The point of the field: shadow evaluation uses it as an `at_least_as_fresh` floor, so a revision
    // read *before* the writes would be the exact opposite of a floor. Ordering is what is asserted here.
    vi.mocked(source.readOrganizationSource).mockResolvedValue({ ...emptySource, teamIds: ["team-1"] });
    let written = false;
    apply.reconcileTeamWorkspace.mockImplementation(async () => {
      written = true;
      return PROJECTED;
    });
    readRelationships.mockImplementation(() =>
      Promise.resolve({
        cursor: null,
        relationships: [],
        snapshot: { token: written ? "after-writes" : "before-writes" },
      })
    );

    const result = await runAuthzedBackfill(request(), dependencies);

    expect(result.completedAtSnapshot).toBe("after-writes");
  });

  test("reports no revision for a dry run, which wrote nothing to be fresh relative to", async () => {
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [],
      snapshot: { token: "revision-42" },
    });

    const result = await runAuthzedBackfill(request({ mode: "dry_run" }), dependencies);

    expect(result.completedAtSnapshot).toBeNull();
  });

  test("reports no revision rather than a stale one when the closing read fails", async () => {
    // No teams or workspaces, so the observation is a single organization read and the second call is the
    // closing capture — which is the one that has to fail for this to test what it claims.
    readRelationships
      .mockResolvedValueOnce({ cursor: null, relationships: [], snapshot: { token: "observed" } })
      .mockRejectedValue(new Error("connection reset"));

    const result = await runAuthzedBackfill(request(), dependencies);

    // A floor that might pre-date the writes is worse than no floor at all.
    expect(result.completedAtSnapshot).toBeNull();
    expect(result.counters.reconciled).toBe(1);
  });

  test("counts deliberately unprojected relationships as ignored, never orphaned", async () => {
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [
        {
          relation: "workspace",
          resource: { objectId: "survey-1", objectType: "survey" },
          subject: { objectId: "ws-1", objectType: "workspace" },
        },
      ],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    expect(result.counters.ignored).toBe(1);
    expect(result.counters.orphaned).toBe(0);
    expect(result.counters.pruned).toBe(0);
  });

  test("reports unrecognized relationships without reconciling them", async () => {
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [
        {
          relation: "superuser",
          resource: { objectId: "org-1", objectType: "organization" },
          subject: { objectId: "user-1", objectType: "user" },
        },
      ],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(request({ prune: true }), dependencies);

    expect(result.unmanaged).toEqual([
      { objectId: "org-1", objectType: "organization", relation: "superuser" },
    ]);
    expect(result.counters.pruned).toBe(0);
  });

  test("reports a cross-organization workspace-team grant without acting on it", async () => {
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      invalidWorkspaceTeamGrants: [{ teamId: "foreign-team", workspaceId: "ws-1" }],
    });

    const result = await runAuthzedBackfill(request(), dependencies);

    expect(result.counters.invalid).toBe(1);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceTeamGrants: expect.arrayContaining([expect.anything()]) })
    );
  });
});

describe("workspace scope", () => {
  const missingWorkspace = (): void => {
    vi.mocked(source.readWorkspaceSource).mockResolvedValue({
      apiKeyWorkspaceGrants: [],
      expectedRelationships: [],
      feedbackDirectoryAssignments: [],
      invalidApiKeyWorkspaceGrants: [],
      invalidFeedbackDirectoryAssignments: [],
      invalidWorkspaceTeamGrants: [],
      organizationId: null,
      workspaceExists: false,
      workspaceTeamGrants: [],
    });
  };

  test("does not remove a missing workspace's relationships without permission to prune", async () => {
    // Naming a workspace with no row is what removes *every* relationship on it — team grants and
    // API-key grants included. That is a prune, so it needs the prune flags rather than happening as a
    // side effect of `--apply` on a stale ID.
    missingWorkspace();

    const result = await runAuthzedBackfill(
      request({ scope: { kind: "workspace", workspaceId: "ghost-ws" } }),
      dependencies
    );

    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: ["ghost-ws"] })
    );
    expect(result.counters.pruned).toBe(0);
  });

  test("withholds the whole-workspace deletion when the orphan count exceeds the budget", async () => {
    // Naming a workspace with no row removes every relationship on it. An over-cap unit reported
    // `skipped: 1, pruned: 0` and still performed exactly that deletion, which inverts the cap.
    missingWorkspace();
    vi.mocked(source.findMissingSourceRefs).mockResolvedValue([
      { kind: "workspaceTeamGrant", teamId: "team-1", workspaceId: "ghost-ws" },
      { kind: "workspaceTeamGrant", teamId: "team-2", workspaceId: "ghost-ws" },
    ]);

    const result = await runAuthzedBackfill(
      request({ maxPrune: 1, prune: true, scope: { kind: "workspace", workspaceId: "ghost-ws" } }),
      dependencies
    );

    expect(result.counters.skipped).toBe(1);
    expect(result.counters.pruned).toBe(0);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: ["ghost-ws"] })
    );
  });

  test("removes a missing workspace's relationships when pruning is permitted", async () => {
    missingWorkspace();

    await runAuthzedBackfill(
      request({ prune: true, scope: { kind: "workspace", workspaceId: "ghost-ws" } }),
      dependencies
    );

    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: ["ghost-ws"] })
    );
  });

  test("withholds a grant whose principal is gone, since deleting it would reach other tenants", async () => {
    // A grant ref implies its team, and a team with no PostgreSQL row makes the reconciler delete that
    // team's grants on *every* workspace — outside this scope and outside its budget.
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) =>
      Promise.resolve(refs.filter((ref) => ref.kind === "workspaceTeamGrant" || ref.kind === "team"))
    );
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [
        {
          relation: "reader_team",
          resource: { objectId: "ws-1", objectType: "workspace" },
          subject: { objectId: "ghost-team", objectType: "team", relation: "member" },
        },
      ],
      snapshot: { token: "revision-1" },
    });

    const result = await runAuthzedBackfill(
      request({ prune: true, scope: { kind: "workspace", workspaceId: "ws-1" } }),
      dependencies
    );

    // Counted, so the run stays drifted and tells the operator a wider scope is needed…
    expect(result.counters.orphaned).toBe(1);
    // …but never handed over, because the delete would not stay inside this workspace.
    expect(result.counters.pruned).toBe(0);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceTeamGrants: [{ teamId: "ghost-team", workspaceId: "ws-1" }],
      })
    );
    expect(result.status).toBe("drifted");
  });

  test("still projects the parent edge of a workspace that exists", async () => {
    // The same target list drives the write when the row is present, so gating it on pruning must not
    // stop an existing workspace's own parent edge from being projected.
    await runAuthzedBackfill(request({ scope: { kind: "workspace", workspaceId: "ws-1" } }), dependencies);

    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: ["ws-1"] })
    );
  });

  test("attributes a failure to the owning organization rather than to no tenant", async () => {
    apply.reconcileTeamWorkspace.mockResolvedValue({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });

    const result = await runAuthzedBackfill(
      request({ scope: { kind: "workspace", workspaceId: "ws-1" } }),
      dependencies
    );

    // The empty string is the sweep's marker for an orphan with no organization left, so a workspace that
    // still has a row must not report it.
    expect(result.failures).toEqual([
      { attempts: 1, code: AUTHZED_ERROR_CODES.UNAVAILABLE, organizationId: "org-1", retryable: true },
    ]);
  });
});

describe("full-scope orphan sweep", () => {
  const ghostWorkspace = {
    relation: "organization",
    resource: { objectId: "ghost-ws", objectType: "workspace" },
    subject: { objectId: "gone-org", objectType: "organization" },
  };

  beforeEach(() => {
    vi.mocked(source.readOrganizationIdPage).mockResolvedValueOnce([]).mockResolvedValue([]);
    // The sweep reads one resource type at a time, so the fixture has to answer per type — the ghost
    // workspace exists on `workspace` and nowhere else.
    readRelationships.mockImplementation(({ filter }) =>
      Promise.resolve(
        filter.resourceType === "workspace"
          ? { cursor: null, relationships: [ghostWorkspace], snapshot: { token: "revision-1" } }
          : emptyPage
      )
    );
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) =>
      Promise.resolve(refs.length > 0 ? [{ kind: "workspace", workspaceId: "ghost-ws" }] : [])
    );
  });

  test("finds a resource unreachable from any organization and reports it", async () => {
    // A workspace whose organization is also gone cannot be reached by enumerating organizations, which
    // is the whole reason the full sweep filters by resource type instead.
    const result = await runAuthzedBackfill(request({ scope: { kind: "all" } }), dependencies);

    expect(result.counters.orphaned).toBe(1);
    expect(result.counters.pruned).toBe(0);
    expect(result.orphanScope).toBe("all");
    expect(result.status).toBe("drifted");
  });

  test("hands the orphan to a reconciler as a target when pruning", async () => {
    const result = await runAuthzedBackfill(request({ prune: true, scope: { kind: "all" } }), dependencies);

    expect(result.counters.pruned).toBe(1);
    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: ["ghost-ws"] })
    );
    expect(result.status).toBe("reconciled");
  });

  test("prunes every orphan inside the budget, even past the 100-entry reporting cap", async () => {
    // The reported lists cap at 100 so a broken instance cannot emit a huge line; the prune budget is
    // 500. Conflating the two would silently prune only the first 100 of a run well inside its budget
    // and report that as a success.
    const ghosts = Array.from({ length: 150 }, (_unused, index) => ({
      kind: "workspace" as const,
      workspaceId: `ghost-${index}`,
    }));
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) =>
      Promise.resolve(refs.length > 0 ? ghosts : [])
    );

    const result = await runAuthzedBackfill(
      request({ maxPrune: 500, prune: true, scope: { kind: "all" } }),
      dependencies
    );

    expect(result.counters.orphaned).toBe(150);
    expect(result.counters.pruned).toBe(150);
    expect(result.counters.skipped).toBe(0);
    // Reported lists stay capped while the counters carry the true totals.
    expect(result.orphans).toHaveLength(100);
    expect(result.status).toBe("reconciled");
  });

  test("prunes nothing at all when a later page pushes the total past the cap", async () => {
    // The cap is an abort-before-delete guard, so it has to be decided against the *whole* sweep. Enforced
    // per page it would delete every page that fit and stop at the one that did not — so a run aimed at
    // the wrong database would revoke a cap's worth of live access instead of revoking none.
    const secondGhost = {
      relation: "organization",
      resource: { objectId: "ghost-ws-2", objectType: "workspace" },
      subject: { objectId: "gone-org", objectType: "organization" },
    };
    readRelationships.mockImplementation(({ cursor, filter }) =>
      Promise.resolve(
        filter.resourceType !== "workspace"
          ? emptyPage
          : cursor === undefined
            ? {
                cursor: { token: "page-2" },
                relationships: [ghostWorkspace],
                snapshot: { token: "revision-1" },
              }
            : { cursor: null, relationships: [secondGhost], snapshot: { token: "revision-1" } }
      )
    );
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) => Promise.resolve(refs));

    const result = await runAuthzedBackfill(
      request({ maxPrune: 1, prune: true, scope: { kind: "all" } }),
      dependencies
    );

    // Both counted — the total is the diagnostic, and it is what says how far off the run is.
    expect(result.counters.orphaned).toBe(2);
    // The first page fit the budget of one. It is still not deleted.
    expect(result.counters.pruned).toBe(0);
    expect(result.counters.skipped).toBe(1);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceIds: expect.arrayContaining(["ghost-ws"]) })
    );
    expect(result.status).toBe("drifted");
  });

  test("reports truncated rather than growing the dedupe set without bound", async () => {
    // The dedupe set is the one structure in a streaming sweep that grows with the store. Past its
    // bound the sweep keeps counting and says so, instead of holding a key for every record on the
    // heap — and a run this far past the prune cap deletes nothing on the strength of it anyway.
    const ghosts = Array.from({ length: AUTHZED_MAX_TRACKED_ORPHAN_REFS + 1 }, (_unused, index) => ({
      kind: "workspace" as const,
      workspaceId: `ghost-${index}`,
    }));
    vi.mocked(source.findMissingSourceRefs).mockImplementation((refs) =>
      Promise.resolve(refs.length > 0 ? ghosts : [])
    );

    const result = await runAuthzedBackfill(request({ prune: true, scope: { kind: "all" } }), dependencies);

    expect(result.counters.orphaned).toBe(AUTHZED_MAX_TRACKED_ORPHAN_REFS + 1);
    expect(result.truncated).toBe(true);
    // Far past the cap, so nothing is deleted and the run degrades into a report.
    expect(result.counters.pruned).toBe(0);
    expect(result.counters.skipped).toBe(1);
    expect(result.status).toBe("drifted");
  });

  test("counts a record implied by two pages once", async () => {
    // SpiceDB returns alternate relations on one resource grouped by relation rather than adjacently, so
    // the tuples implying a single record straddle a page boundary in any tenant larger than a page.
    // Counting it twice would inflate the total that the cap is compared against.
    readRelationships.mockImplementation(({ cursor, filter }) =>
      Promise.resolve(
        filter.resourceType !== "workspace"
          ? emptyPage
          : cursor === undefined
            ? {
                cursor: { token: "page-2" },
                relationships: [ghostWorkspace],
                snapshot: { token: "revision-1" },
              }
            : { cursor: null, relationships: [ghostWorkspace], snapshot: { token: "revision-1" } }
      )
    );

    const result = await runAuthzedBackfill(
      request({ maxPrune: 1, prune: true, scope: { kind: "all" } }),
      dependencies
    );

    expect(result.counters.orphaned).toBe(1);
    expect(result.orphans).toEqual([{ kind: "workspace", workspaceId: "ghost-ws" }]);
    // Deduplicated to one, so it fits the budget of one and is pruned rather than skipped.
    expect(result.counters.pruned).toBe(1);
    expect(result.counters.skipped).toBe(0);
  });

  test("prunes nothing when the sweep's orphan count exceeds the cap", async () => {
    vi.mocked(source.findMissingSourceRefs).mockResolvedValue([
      { kind: "workspace", workspaceId: "ghost-1" },
      { kind: "workspace", workspaceId: "ghost-2" },
    ]);

    const result = await runAuthzedBackfill(
      request({ maxPrune: 1, prune: true, scope: { kind: "all" } }),
      dependencies
    );

    expect(result.counters.pruned).toBe(0);
    expect(result.counters.skipped).toBe(1);
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalled();
  });

  test("records a prune failure against no organization, since the resource has none", async () => {
    apply.reconcileTeamWorkspace.mockResolvedValue({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });

    const result = await runAuthzedBackfill(request({ prune: true, scope: { kind: "all" } }), dependencies);

    expect(result.counters.pruned).toBe(0);
    expect(result.failures[0]).toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      organizationId: "",
      retryable: true,
    });
    expect(result.status).toBe("failed");
  });

  test("marks the report truncated when the sweep itself fails", async () => {
    readRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.LIMIT_EXCEEDED,
        operation: "read_all_relationships",
        retryable: false,
      })
    );

    const result = await runAuthzedBackfill(request({ prune: true, scope: { kind: "all" } }), dependencies);

    expect(result.truncated).toBe(true);
    expect(result.counters.pruned).toBe(0);
    expect(result.failures[0]).toMatchObject({ code: AUTHZED_ERROR_CODES.LIMIT_EXCEEDED });
    expect(result.status).toBe("failed");
  });
});

describe("chunking", () => {
  test("splits a large target list so no reconciler receives an unbounded query", async () => {
    const memberships = Array.from({ length: AUTHZED_TARGET_CHUNK_SIZE + 1 }, (_unused, index) => ({
      organizationId: "org-1",
      userId: `user-${index}`,
    }));
    vi.mocked(source.readOrganizationSource).mockResolvedValue({ ...emptySource, memberships });

    await runAuthzedBackfill(request(), dependencies);

    expect(apply.reconcileMemberships).toHaveBeenCalledTimes(2);
    expect(apply.reconcileMemberships.mock.calls[0][0].memberships).toHaveLength(AUTHZED_TARGET_CHUNK_SIZE);
    expect(apply.reconcileMemberships.mock.calls[1][0].memberships).toHaveLength(1);
  });

  test("never hands an empty target list to a reconciler", async () => {
    // The write facade rejects an empty batch as an invalid request.
    await runAuthzedBackfill(request(), dependencies);

    expect(apply.reconcileMemberships).not.toHaveBeenCalled();
    expect(apply.reconcileTeamWorkspace).not.toHaveBeenCalled();
    expect(apply.reconcileApiKeys).not.toHaveBeenCalled();
  });

  test("passes every list a reconciler understands in one call", async () => {
    // A reconciler reads one PostgreSQL snapshot covering all the lists it was given, so splitting them
    // would multiply the snapshot reads and verification passes for no benefit.
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      apiKeyIds: ["key-1"],
      apiKeyWorkspaceGrants: [{ apiKeyId: "key-1", workspaceId: "ws-1" }],
      teamIds: ["team-1"],
      teamMemberships: [{ teamId: "team-1", userId: "user-1" }],
      workspaceIds: ["ws-1"],
      workspaceTeamGrants: [{ teamId: "team-1", workspaceId: "ws-1" }],
    });

    await runAuthzedBackfill(request(), dependencies);

    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledTimes(1);
    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith({
      teamIds: ["team-1"],
      teamMemberships: [{ teamId: "team-1", userId: "user-1" }],
      workspaceIds: ["ws-1"],
      workspaceTeamGrants: [{ teamId: "team-1", workspaceId: "ws-1" }],
    });
    expect(apply.reconcileApiKeys).toHaveBeenCalledTimes(1);
    expect(apply.reconcileApiKeys).toHaveBeenCalledWith({
      apiKeyIds: ["key-1"],
      apiKeyWorkspaceGrants: [{ apiKeyId: "key-1", workspaceId: "ws-1" }],
    });
  });

  test("passes an empty list through untouched rather than asserting a narrowed object type", async () => {
    // Chunking builds each call by narrowing a full target object, so lists with nothing in them arrive
    // as `[]`. Every reconciler treats that as a no-op, and it is what lets the chunker avoid a type
    // assertion that would silently keep compiling if a target field ever became required.
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["team-1"],
    });

    await runAuthzedBackfill(request(), dependencies);

    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledWith({
      teamIds: ["team-1"],
      teamMemberships: [],
      workspaceIds: [],
      workspaceTeamGrants: [],
    });
  });

  test("bounds each list independently, so call count follows the longest list", async () => {
    const teamMemberships = Array.from({ length: AUTHZED_TARGET_CHUNK_SIZE + 1 }, (_unused, index) => ({
      teamId: "team-1",
      userId: `user-${index}`,
    }));
    vi.mocked(source.readOrganizationSource).mockResolvedValue({
      ...emptySource,
      teamIds: ["team-1"],
      teamMemberships,
    });

    await runAuthzedBackfill(request(), dependencies);

    expect(apply.reconcileTeamWorkspace).toHaveBeenCalledTimes(2);
    // The short list is exhausted by the first call and must not be resent.
    expect(apply.reconcileTeamWorkspace.mock.calls[0][0]).toMatchObject({
      teamIds: ["team-1"],
      teamMemberships: teamMemberships.slice(0, AUTHZED_TARGET_CHUNK_SIZE),
    });
    // The short list is exhausted by the first call, so the second must not resend it.
    expect(apply.reconcileTeamWorkspace.mock.calls[1][0]).toMatchObject({
      teamIds: [],
      teamMemberships: teamMemberships.slice(AUTHZED_TARGET_CHUNK_SIZE),
    });
  });
});
