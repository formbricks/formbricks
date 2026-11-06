import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getNumericEmbeddedFields } from "@/modules/ee/analysis/dashboards/lib/embedded-field-types";
import { refuseNonNumericComparisons } from "./numeric-filter-fields";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/analysis/dashboards/lib/embedded-field-types", () => ({
  getNumericEmbeddedFields: vi.fn(),
}));

const SEATS = "FeedbackRecords.ed_seats_0a1b2c3d";
const filter = (id: string, operator: TDashboardFilter["operator"]): TDashboardFilter => ({
  id,
  field: SEATS,
  operator,
  label: "Seats",
});
const datasetIds = vi.fn(async () => ["ds_a"]);
const refuse = (filters: TDashboardFilter[]) =>
  refuseNonNumericComparisons(filters, { workspaceId: "ws_1", datasetIds, requestId: "req" });

beforeEach(() => {
  vi.mocked(getNumericEmbeddedFields).mockReset().mockResolvedValue(new Set());
  datasetIds.mockClear();
});

describe("refuseNonNumericComparisons", () => {
  test("answers 422 naming filter[<id>] for gt on a key that is not a number on the dashboard", async () => {
    const response = await refuse([filter("f1", "equals"), filter("f2", "gt")]);

    expect(response?.status).toBe(422);
    const body = (await response?.json()) as { invalid_params: { name: string }[] };
    expect(body.invalid_params.map(({ name }) => name)).toEqual(["filter[f2]"]);
    expect(getNumericEmbeddedFields).toHaveBeenCalledWith("ws_1", ["ds_a"]);
  });

  test("lets it through on a numeric key", async () => {
    vi.mocked(getNumericEmbeddedFields).mockResolvedValue(new Set([SEATS]));
    expect(await refuse([filter("f1", "lte")])).toBeNull();
  });

  test("reads neither datasets nor types when no filter compares a key with a number", async () => {
    expect(await refuse([filter("f1", "equals"), filter("f2", "set")])).toBeNull();
    expect(datasetIds).not.toHaveBeenCalled();
    expect(getNumericEmbeddedFields).not.toHaveBeenCalled();
  });
});
