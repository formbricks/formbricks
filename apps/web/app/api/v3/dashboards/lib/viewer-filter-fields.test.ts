import { describe, expect, test, vi } from "vitest";
import type { TDashboardsAccessContext } from "@/app/api/v3/lib/dashboards-access";
import type { TDashboardChartsRow } from "./service";
import {
  getGroupedEmbeddedFields,
  mayFilterBy,
  refuseUngroupedFieldsForViewer,
} from "./viewer-filter-fields";

vi.mock("server-only", () => ({}));

const REGION = "FeedbackRecords.ed_region_0a1b2c3d";
const PLAN = "FeedbackRecords.ed_plan_4e5f6a7b";
const SOURCE = "FeedbackRecords.sourceName";

const widgets = (...queries: unknown[]) =>
  queries.map((query) => ({ chart: { query } })) as unknown as TDashboardChartsRow["widgets"];
const viewer = { asDashboardViewer: true } as TDashboardsAccessContext;
const member = {} as TDashboardsAccessContext;
const ctx = { requestId: "req", instance: "/i" };

describe("getGroupedEmbeddedFields", () => {
  test("is the embedded-data dimensions of every chart, and nothing else", () => {
    expect(
      getGroupedEmbeddedFields(
        widgets(
          { measures: ["FeedbackRecords.count"], dimensions: [REGION, SOURCE] },
          { dimensions: [REGION] },
          { measures: ["FeedbackRecords.count"] },
          null
        )
      )
    ).toEqual(new Set([REGION]));
  });
});

describe("mayFilterBy", () => {
  const grouped = new Set([REGION]);

  test("lets a Dashboard viewer filter by a catalog field or a grouped key, not another key", () => {
    expect(mayFilterBy(viewer, SOURCE, grouped)).toBe(true);
    expect(mayFilterBy(viewer, REGION, grouped)).toBe(true);
    expect(mayFilterBy(viewer, PLAN, grouped)).toBe(false);
  });

  test("lets anyone else filter by any key", () => {
    expect(mayFilterBy(member, PLAN, grouped)).toBe(true);
  });
});

describe("refuseUngroupedFieldsForViewer", () => {
  const board = widgets({ dimensions: [REGION] });

  test("refuses a Dashboard viewer naming a key no chart groups by, with the plain 403", async () => {
    const refused = refuseUngroupedFieldsForViewer(viewer, [REGION, PLAN], board, ctx);
    expect(refused?.status).toBe(403);
    expect(await refused?.json()).toMatchObject({ code: "forbidden" });
  });

  test("allows grouped keys and catalog fields, and anyone who is not a viewer", () => {
    expect(refuseUngroupedFieldsForViewer(viewer, [REGION, SOURCE], board, ctx)).toBeNull();
    expect(refuseUngroupedFieldsForViewer(member, [PLAN], board, ctx)).toBeNull();
  });
});
