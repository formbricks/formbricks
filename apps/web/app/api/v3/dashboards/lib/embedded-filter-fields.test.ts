import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import { findUnknownEmbeddedFilterFields } from "./embedded-filter-fields";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { dashboard: { findFirst: vi.fn() } } }));
vi.mock("@/modules/ee/analysis/dashboards/lib/dataset-fields", () => ({ getDatasetFieldMatcher: vi.fn() }));

const WORKSPACE_ID = "clws000000000000000000001";
const DASHBOARD_ID = "clda000000000000000000001";
const READABLE = "clds000000000000000000001";
const UNREADABLE = "clds000000000000000000002";
const PLAN = "FeedbackRecords.ed_plan_64879f7d";

const embeddedFilter: TDashboardFilter = {
  id: "clfi000000000000000000001",
  field: PLAN,
  operator: "equals",
  label: "Plan",
};

const access = { workspaceId: WORKSPACE_ID, organizationId: "clor000000000000000000001" } as never;
const actor = { type: "user", userId: "clus000000000000000000001" } as never;

const find = (canReadDataset: (datasetId: string) => Promise<boolean>) =>
  findUnknownEmbeddedFilterFields({
    dashboardId: DASHBOARD_ID,
    filters: [embeddedFilter],
    access,
    actor,
    canReadDataset,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
    filters: [],
    widgets: [{ chart: { feedbackDirectoryId: READABLE } }, { chart: { feedbackDirectoryId: UNREADABLE } }],
  } as never);
  // Only the unreadable dataset has the key.
  vi.mocked(getDatasetFieldMatcher).mockImplementation(
    async ({ datasetId }) =>
      () =>
        datasetId === UNREADABLE
  );
});

describe("findUnknownEmbeddedFilterFields", () => {
  test("reads the dashboard within the caller's workspace, never by its id alone", async () => {
    await find(async () => true);

    expect(prisma.dashboard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DASHBOARD_ID, workspaceId: WORKSPACE_ID } })
    );
  });

  test("never reads the keys of a dataset the caller may not read, and checks readability first", async () => {
    const order: string[] = [];
    const issues = await find(async (datasetId) => {
      order.push(`authorize:${datasetId}`);
      return datasetId === READABLE;
    });

    expect(getDatasetFieldMatcher).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getDatasetFieldMatcher).mock.calls[0][0]).toMatchObject({ datasetId: READABLE });
    expect(order).toEqual([`authorize:${READABLE}`, `authorize:${UNREADABLE}`]);
    // A key only the unreadable dataset holds is refused like one no dataset holds.
    expect(issues).toEqual([
      expect.objectContaining({ name: "filters[0].field", code: "invalid_reference" }),
    ]);
  });

  test("accepts a key a readable dataset has", async () => {
    expect(await find(async () => true)).toEqual([]);
  });

  test("asks nothing for a key already saved on the dashboard", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
      filters: [{ ...embeddedFilter, values: ["Pro"] }],
      widgets: [{ chart: { feedbackDirectoryId: UNREADABLE } }],
    } as never);
    const canReadDataset = vi.fn(async () => false);

    expect(await find(canReadDataset)).toEqual([]);
    expect(canReadDataset).not.toHaveBeenCalled();
    expect(getDatasetFieldMatcher).not.toHaveBeenCalled();
  });
});
