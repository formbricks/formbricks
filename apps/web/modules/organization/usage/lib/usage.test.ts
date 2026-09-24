import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationUsage } from "./usage";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    workflowRun: { groupBy: vi.fn() },
  },
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn() } }));

const ORG_ID = "clorg11111111111111111111";
const NOW = new Date("2026-09-24T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** The raw SQL template's text, so a mocked `$queryRaw` call can be routed by what it selects. */
const sqlText = (call: unknown[]): string => (call[0] as TemplateStringsArray).join("?");

const mockQueries = () => {
  vi.mocked(prisma.$queryRaw).mockImplementation(((strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (text.includes('FROM "Workspace" w')) {
      return Promise.resolve([
        { id: "ws_eu", name: "Europe", responseCount: 65n },
        { id: "ws_na", name: "North America", responseCount: 44n },
        { id: "ws_apac", name: "Asia Pacific", responseCount: 0n },
      ]);
    }
    if (text.includes('FROM "Survey" s')) {
      return Promise.resolve([
        { draft: 1n, scheduled: 0n, inProgress: 2n, paused: 1n, completed: 1n, archived: 1n },
      ]);
    }
    return Promise.resolve([{ total: 6n, active: 2n, dormant: 2n, deactivated: 1n }]);
  }) as never);
};

describe("getOrganizationUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false);
  });

  test("returns per-workspace responses, a total that adds them up, and plain numbers", async () => {
    const usage = await getOrganizationUsage({
      organizationId: ORG_ID,
      range: {},
      timeZone: "UTC",
      now: NOW,
    });

    expect(usage.workspaces).toEqual([
      { id: "ws_eu", name: "Europe", responseCount: 65, workflowRunCount: null },
      { id: "ws_na", name: "North America", responseCount: 44, workflowRunCount: null },
      { id: "ws_apac", name: "Asia Pacific", responseCount: 0, workflowRunCount: null },
    ]);
    expect(usage.totals).toEqual({ responseCount: 109, workflowRunCount: null });
    expect(usage.surveys).toEqual({
      draft: 1,
      scheduled: 0,
      inProgress: 2,
      paused: 1,
      completed: 1,
      archived: 1,
    });
    expect(usage.members).toEqual({ total: 6, active: 2, dormant: 2, deactivated: 1 });
    expect(usage.timeZone).toBe("UTC");
  });

  test("scopes every raw query to the organization", async () => {
    await getOrganizationUsage({ organizationId: ORG_ID, range: {}, timeZone: "UTC", now: NOW });

    const calls = vi.mocked(prisma.$queryRaw).mock.calls;
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call).toContain(ORG_ID);
    }
  });

  test("does not count workflow runs without the Workflows entitlement", async () => {
    await getOrganizationUsage({ organizationId: ORG_ID, range: {}, timeZone: "UTC", now: NOW });

    expect(prisma.workflowRun.groupBy).not.toHaveBeenCalled();
  });

  test("counts non-dry workflow runs per workspace in the range when entitled", async () => {
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
    vi.mocked(prisma.workflowRun.groupBy).mockResolvedValue([
      { workspaceId: "ws_eu", _count: { _all: 7 } },
    ] as never);
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-09-24T23:59:59.999Z");

    const usage = await getOrganizationUsage({
      organizationId: ORG_ID,
      range: { from, to },
      timeZone: "UTC",
      now: NOW,
    });

    expect(prisma.workflowRun.groupBy).toHaveBeenCalledWith({
      by: ["workspaceId"],
      where: { workspace: { organizationId: ORG_ID }, isDryRun: false, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    expect(usage.workspaces.map((workspace) => workspace.workflowRunCount)).toEqual([7, 0, 0]);
    expect(usage.totals.workflowRunCount).toBe(7);
  });

  test("bounds the response count by the range and leaves it open for all-time", async () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T23:59:59.999Z");

    await getOrganizationUsage({ organizationId: ORG_ID, range: { from, to }, timeZone: "UTC", now: NOW });
    const bounded = vi
      .mocked(prisma.$queryRaw)
      .mock.calls.find((call) => sqlText(call).includes('"Workspace" w'));
    expect(JSON.stringify(bounded)).toContain(from.toISOString());
    expect(JSON.stringify(bounded)).toContain(to.toISOString());

    vi.mocked(prisma.$queryRaw).mockClear();
    await getOrganizationUsage({ organizationId: ORG_ID, range: {}, timeZone: "UTC", now: NOW });
    const open = vi
      .mocked(prisma.$queryRaw)
      .mock.calls.find((call) => sqlText(call).includes('"Workspace" w'));
    expect(JSON.stringify(open)).not.toContain("created_at");
  });

  // A signed-up owner's own membership is stored with `accepted = false`, and nothing gates access on the
  // flag, so filtering on it silently drops real members from every count.
  test("counts every membership, not only accepted ones", async () => {
    await getOrganizationUsage({ organizationId: ORG_ID, range: {}, timeZone: "UTC", now: NOW });

    const members = vi
      .mocked(prisma.$queryRaw)
      .mock.calls.find((call) => sqlText(call).includes('"Membership" m'));
    expect(sqlText(members!)).not.toContain("accepted");
  });

  test("puts the active and dormant cut-offs 30 and 90 days before now", async () => {
    await getOrganizationUsage({ organizationId: ORG_ID, range: {}, timeZone: "UTC", now: NOW });

    const members = vi
      .mocked(prisma.$queryRaw)
      .mock.calls.find((call) => sqlText(call).includes('"Membership" m'));
    expect(members).toContainEqual(new Date(NOW.getTime() - 30 * DAY));
    expect(members).toContainEqual(new Date(NOW.getTime() - 90 * DAY));
  });
});
