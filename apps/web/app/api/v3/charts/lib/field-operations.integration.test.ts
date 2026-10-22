import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { getV3ChartFieldCatalog } from "./field-operations";
import { ZV3ChartFieldCatalog } from "./resources";

/**
 * ENG-6584 against real PostgreSQL and SpiceDB: the field catalog, and the access check every later chart
 * and dashboard operation reuses — workspace access first, the Dashboards entitlement second, then the
 * Feedback Dataset.
 */

const entitlement = vi.hoisted(() => ({ dashboards: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
}));

let fixture: TDashboardsFixture;

const readCatalog = (
  authentication: ReturnType<typeof sessionOf>,
  overrides: Partial<Record<"workspaceId" | "datasetId", string>> = {}
) =>
  getV3ChartFieldCatalog({
    workspaceId: fixture.workspaceId,
    datasetId: fixture.datasetId,
    ...overrides,
    authentication,
    requestId: "req",
    instance: "/api/v3/charts/fields",
  });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
}, 120_000);

beforeEach(() => {
  entitlement.dashboards = true;
});

describe("GET /api/v3/charts/fields", () => {
  test("returns the catalog, with the date presets, to anyone who may read the dataset", async () => {
    for (const authentication of [
      sessionOf(fixture.users.owner),
      sessionOf(fixture.users.viewer),
      apiKeyOf(fixture, "readKey"),
    ]) {
      const response = await readCatalog(authentication);
      expect(response.status).toBe(200);

      const data = ZV3ChartFieldCatalog.parse(((await response.json()) as { data: unknown }).data);
      expect(data.fields.map((field) => field.name)).toContain("FeedbackRecords.npsScore");
      expect(data.datePresets).toEqual(expect.arrayContaining(["last 7 days", "all-time"]));
    }
  });

  test("refuses a member without workspace access, and a workspace in another organization, with 403", async () => {
    expect(await outcomeOf(await readCatalog(sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(
      await outcomeOf(
        await readCatalog(sessionOf(fixture.users.owner), {
          workspaceId: fixture.foreignWorkspaceId,
          datasetId: fixture.foreignDatasetId,
        })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });

  test("refuses a dataset not assigned to the workspace, or from another organization, with the same 403", async () => {
    for (const datasetId of [
      fixture.unassignedDatasetId,
      fixture.foreignDatasetId,
      "clzzzzzzzzzzzzzzzzzzzzzzz",
    ]) {
      expect(await outcomeOf(await readCatalog(sessionOf(fixture.users.owner), { datasetId }))).toEqual({
        status: 403,
        code: "forbidden",
      });
    }
  });

  test("names the missing plan only after the caller is authorized", async () => {
    entitlement.dashboards = false;

    expect(await outcomeOf(await readCatalog(sessionOf(fixture.users.viewer)))).toEqual({
      status: 403,
      code: "dashboards_plan_required",
    });
    // A caller without access must not learn the organization's plan.
    expect(await outcomeOf(await readCatalog(sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });
  });
});
