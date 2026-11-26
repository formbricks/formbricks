import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TAuthzedRelationship, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import {
  dashboardPageRelationshipsOnDashboardFilter,
  diffDashboardRelationships,
  expectedDashboardPageRelationships,
  expectedDashboardRelationships,
  reconcileDashboardRelationships,
} from "./dashboard";
import {
  teamWorkspacePairKey,
  toDashboardPageProjectionRow,
  toDashboardProjectionRow,
} from "./dashboard-relationships";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

const clientMocks = {
  deleteRelationships: vi.fn(),
  readRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));
vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));

const ORGANIZATION_ID = "org-1";

const edge = (
  resourceType: string,
  resourceId: string,
  relation: string,
  subjectType: string,
  subjectId: string
): TAuthzedRelationship => ({
  relation,
  resource: { objectId: resourceId, objectType: resourceType },
  subject: { objectId: subjectId, objectType: subjectType },
});

const teamLimit = (teamId: string, organizationId = ORGANIZATION_ID) => ({
  team: { organizationId },
  teamId,
});

const dashboardRow = (teamIds: ReadonlyArray<string>, workspaceId = "ws-1") => ({
  id: "dash-1",
  teamLimits: teamIds.map((teamId) => teamLimit(teamId)),
  workspace: { organizationId: ORGANIZATION_ID },
  workspaceId,
});

const pageRow = (teamIds: ReadonlyArray<string>, teamLimited = teamIds.length > 0) => ({
  dashboard: { workspace: { organizationId: ORGANIZATION_ID } },
  dashboardId: "dash-1",
  id: "page-1",
  teamLimited,
  teamLimits: teamIds.map((teamId) => teamLimit(teamId)),
});

/** The graph's current edges for one resource, as `readRelationships` pages them. */
const setGraph = (relationships: ReadonlyArray<TAuthzedRelationship>): void => {
  clientMocks.readRelationships.mockImplementation(
    async ({ filter }: { filter: { resourceId: string; resourceType: string } }) => ({
      cursor: null,
      relationships: relationships.filter(
        ({ resource }) =>
          resource.objectId === filter.resourceId && resource.objectType === filter.resourceType
      ),
      snapshot: null,
    })
  );
};

const writtenUpdates = (): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  clientMocks.writeRelationships.mock.calls.flatMap(([batch]) => batch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAuthzedEnabled).mockReturnValue(true);
  vi.mocked(getAuthzedClient).mockReturnValue(clientMocks as unknown as ReturnType<typeof getAuthzedClient>);
  clientMocks.deleteRelationships.mockResolvedValue(undefined);
  clientMocks.writeRelationships.mockResolvedValue(undefined);
  setGraph([]);
  vi.mocked(prisma.dashboard.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([] as never);
  prisma.$executeRaw.mockResolvedValue(1);
  // The transaction client is the shared mock itself, so its reads and lock calls are the same functions.
  prisma.$transaction.mockImplementation(async (callback) =>
    typeof callback === "function" ? callback(prisma) : []
  );
});

describe("expected dashboard relationships (ADR-0060)", () => {
  test("a dashboard always names its workspace and each selecting team, sorted and deduplicated", () => {
    expect(
      expectedDashboardRelationships({
        id: "dash-1",
        selectedByTeamIds: ["t-b", "t-a", "t-b"],
        workspaceId: "ws-1",
      })
    ).toEqual([
      edge("dashboard", "dash-1", "workspace", "workspace", "ws-1"),
      edge("dashboard", "dash-1", "selected_by_team", "team", "t-a"),
      edge("dashboard", "dash-1", "selected_by_team", "team", "t-b"),
    ]);
  });

  test("a page without a team limit is open on its dashboard", () => {
    expect(
      expectedDashboardPageRelationships({
        dashboardId: "dash-1",
        id: "page-1",
        limited: false,
        limitedTeamIds: [],
      })
    ).toEqual([
      edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      edge("dashboard_page", "page-1", "open_on", "dashboard", "dash-1"),
    ]);
  });

  test("a limited page carries its teams and never `open_on`", () => {
    const relationships = expectedDashboardPageRelationships({
      dashboardId: "dash-1",
      id: "page-1",
      limited: true,
      limitedTeamIds: ["t-1"],
    });
    expect(relationships).toEqual([
      edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      edge("dashboard_page", "page-1", "limited_team", "team", "t-1"),
    ]);
  });

  // P-ENG-110: an empty access selector means no access. A page whose last limited team was deleted
  // (or never had one picked) stays closed rather than reopening to every reader of its dashboard.
  test("a limited page with no teams left is open to no one: neither `open_on` nor a team", () => {
    expect(
      expectedDashboardPageRelationships({
        dashboardId: "dash-1",
        id: "page-1",
        limited: true,
        limitedTeamIds: [],
      })
    ).toEqual([edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1")]);
  });

  test("a page with a limit row stays limited even when the row's team is of another organization", () => {
    const row = toDashboardPageProjectionRow({
      dashboardId: "dash-1",
      id: "page-1",
      organizationId: ORGANIZATION_ID,
      teamLimited: false,
      teamLimits: [teamLimit("t-foreign", "org-2")],
    });
    expect(row).toEqual({ dashboardId: "dash-1", id: "page-1", limited: true, limitedTeamIds: [] });
  });

  test("only teams of the dashboard's organization that hold its workspace select it", () => {
    const row = toDashboardProjectionRow(
      {
        id: "dash-1",
        organizationId: ORGANIZATION_ID,
        teamLimits: [teamLimit("t-granted"), teamLimit("t-ungranted"), teamLimit("t-foreign", "org-2")],
        workspaceId: "ws-1",
      },
      new Set([teamWorkspacePairKey("t-granted", "ws-1"), teamWorkspacePairKey("t-foreign", "ws-1")])
    );
    expect(row.selectedByTeamIds).toEqual(["t-granted"]);
  });

  test("the diff touches every expected edge and deletes every other edge on the resource", () => {
    const stale = edge("dashboard_page", "page-1", "open_on", "dashboard", "dash-1");
    const kept = edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1");
    const added = edge("dashboard_page", "page-1", "limited_team", "team", "t-1");

    expect(diffDashboardRelationships([kept, stale], [kept, added])).toEqual([
      { operation: "touch", relationship: kept },
      { operation: "touch", relationship: added },
      { operation: "delete", relationship: stale },
    ]);
  });
});

describe("reconcileDashboardRelationships", () => {
  test("writes a dashboard's workspace and the selection of a team that holds the workspace", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([
      dashboardRow(["t-granted", "t-ungranted"]),
    ] as never);
    vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValue([
      { teamId: "t-granted", workspaceId: "ws-1" },
    ] as never);
    setGraph([edge("dashboard", "dash-1", "selected_by_team", "team", "t-ungranted")]);

    await expect(reconcileDashboardRelationships({ dashboardIds: ["dash-1"] })).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    expect(prisma.workspaceTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { teamId: "t-granted", workspaceId: "ws-1" },
            { teamId: "t-ungranted", workspaceId: "ws-1" },
          ],
        },
      })
    );
    expect(writtenUpdates()).toEqual([
      { operation: "touch", relationship: edge("dashboard", "dash-1", "workspace", "workspace", "ws-1") },
      {
        operation: "touch",
        relationship: edge("dashboard", "dash-1", "selected_by_team", "team", "t-granted"),
      },
      {
        operation: "delete",
        relationship: edge("dashboard", "dash-1", "selected_by_team", "team", "t-ungranted"),
      },
    ]);
  });

  test("moves a dashboard to its new workspace, dropping the old workspace edge", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([dashboardRow([], "ws-2")] as never);
    setGraph([edge("dashboard", "dash-1", "workspace", "workspace", "ws-1")]);

    await reconcileDashboardRelationships({ dashboardIds: ["dash-1"] });

    expect(writtenUpdates()).toEqual([
      { operation: "touch", relationship: edge("dashboard", "dash-1", "workspace", "workspace", "ws-2") },
      { operation: "delete", relationship: edge("dashboard", "dash-1", "workspace", "workspace", "ws-1") },
    ]);
  });

  // A page's first limit must remove `open_on` in the same write that adds the team, or the page would
  // either sit open past its limit or closed to everyone in between.
  test("limits a page in one write: the team edge in, `open_on` out", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([pageRow(["t-1"])] as never);
    setGraph([
      edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      edge("dashboard_page", "page-1", "open_on", "dashboard", "dash-1"),
    ]);

    await reconcileDashboardRelationships({ pageIds: ["page-1"] });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
    expect(writtenUpdates()).toEqual([
      {
        operation: "touch",
        relationship: edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      },
      { operation: "touch", relationship: edge("dashboard_page", "page-1", "limited_team", "team", "t-1") },
      {
        operation: "delete",
        relationship: edge("dashboard_page", "page-1", "open_on", "dashboard", "dash-1"),
      },
    ]);
  });

  test("reopens a page whose last limit was removed", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([pageRow([])] as never);
    setGraph([
      edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      edge("dashboard_page", "page-1", "limited_team", "team", "t-1"),
    ]);

    await reconcileDashboardRelationships({ pageIds: ["page-1"] });

    expect(writtenUpdates()).toContainEqual({
      operation: "touch",
      relationship: edge("dashboard_page", "page-1", "open_on", "dashboard", "dash-1"),
    });
    expect(writtenUpdates()).toContainEqual({
      operation: "delete",
      relationship: edge("dashboard_page", "page-1", "limited_team", "team", "t-1"),
    });
  });

  test("keeps a page whose last limited team was deleted closed: `limited_team` out, no `open_on` in", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([pageRow([], true)] as never);
    setGraph([
      edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      edge("dashboard_page", "page-1", "limited_team", "team", "t-1"),
    ]);

    await reconcileDashboardRelationships({ pageIds: ["page-1"] });

    expect(writtenUpdates()).toEqual([
      {
        operation: "touch",
        relationship: edge("dashboard_page", "page-1", "dashboard", "dashboard", "dash-1"),
      },
      {
        operation: "delete",
        relationship: edge("dashboard_page", "page-1", "limited_team", "team", "t-1"),
      },
    ]);
  });

  test("removes a deleted dashboard's edges and its pages' edges onto it, and a deleted page's edges", async () => {
    await reconcileDashboardRelationships({ dashboardIds: ["dash-gone"], pageIds: ["page-gone"] });

    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceId: "dash-gone",
      resourceType: "dashboard",
    });
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith(
      dashboardPageRelationshipsOnDashboardFilter("dash-gone")
    );
    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceId: "page-gone",
      resourceType: "dashboard_page",
    });
  });

  // A reconcile that read an older row must not write after a newer one, even if it fails before its
  // re-read: every reconcile of a resource holds that resource's lock from its first read to its last.
  test("holds each target's lock, in one fixed order, before reading or writing anything", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([pageRow(["t-1"])] as never);

    await reconcileDashboardRelationships({ dashboardIds: ["dash-b", "dash-a"], pageIds: ["page-1"] });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const [sql, keys] = prisma.$executeRaw.mock.calls[0] as [TemplateStringsArray, string[]];
    expect(sql.join("?")).toContain("pg_advisory_xact_lock(hashtext(key))");
    expect(keys).toEqual([
      "authzed-dashboard:dash-a",
      "authzed-dashboard:dash-b",
      "authzed-dashboard-page:page-1",
    ]);
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.dashboardPage.findMany).mock.invocationCallOrder[0]
    );
  });

  test("reads nothing and writes nothing without targets", async () => {
    await expect(reconcileDashboardRelationships({})).resolves.toEqual({ passes: 0, status: "projected" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dashboard.findMany).not.toHaveBeenCalled();
    expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
  });

  test("reconciles again when the rows change during the pass, and fails once they never settle", async () => {
    let call = 0;
    vi.mocked(prisma.dashboard.findMany).mockImplementation((async () => [
      dashboardRow([], `ws-${call++}`),
    ]) as never);

    await expect(reconcileDashboardRelationships({ dashboardIds: ["dash-1"] })).resolves.toMatchObject({
      code: "authzed_projection_unstable",
      status: "failed",
    });
    expect(prisma.dashboard.findMany).toHaveBeenCalledTimes(6);
  });

  test("returns a failure instead of throwing when SpiceDB refuses the write", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([dashboardRow([])] as never);
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(reconcileDashboardRelationships({ dashboardIds: ["dash-1"] })).resolves.toMatchObject({
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });
  });

  describe("write deadline", () => {
    const NOW = new Date("2026-11-26T12:00:00.000Z").getTime();

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test("carries a deadline short of the transaction timeout on every write", async () => {
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue([dashboardRow([])] as never);

      await reconcileDashboardRelationships({ dashboardIds: ["dash-1"] });

      expect(clientMocks.writeRelationships).toHaveBeenCalledWith(expect.any(Array), {
        deadline: NOW + 25_000,
      });
    });

    test("sends no write once the locks may have been released, and fails as fenced", async () => {
      vi.mocked(prisma.dashboard.findMany).mockImplementation((async () => {
        // A slow read: by the time the pass writes, the deadline has passed.
        vi.setSystemTime(NOW + 26_000);
        return [dashboardRow([])];
      }) as never);

      await expect(reconcileDashboardRelationships({ dashboardIds: ["dash-1"] })).resolves.toMatchObject({
        code: "authzed_projection_fenced",
        retryable: true,
        status: "failed",
      });
      expect(clientMocks.writeRelationships).not.toHaveBeenCalled();
    });

    test("starts no further delete batch once the deadline passes between batches", async () => {
      // Six deleted dashboards: two delete filters each, so a first batch of 10 and a second of 2.
      const dashboardIds = ["d1", "d2", "d3", "d4", "d5", "d6"];
      clientMocks.deleteRelationships.mockImplementation(async () => {
        vi.setSystemTime(NOW + 26_000);
      });

      await expect(reconcileDashboardRelationships({ dashboardIds })).resolves.toMatchObject({
        code: "authzed_projection_fenced",
        retryable: true,
        status: "failed",
      });
      expect(clientMocks.deleteRelationships).toHaveBeenCalledTimes(10);
    });
  });

  test("is disabled, touching nothing, while AuthZed is off", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileDashboardRelationships({ dashboardIds: ["dash-1"] })).resolves.toEqual({
      status: "disabled",
    });
    expect(prisma.dashboard.findMany).not.toHaveBeenCalled();
  });
});
