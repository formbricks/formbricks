import { beforeEach, describe, expect, test, vi } from "vitest";
import { getDatasetFieldMatcher } from "./dataset-fields";

const { mockResolve } = vi.hoisted(() => ({ mockResolve: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/analysis/lib/dataset-embedded-keys", () => ({
  resolveEmbeddedMemberKeys: mockResolve,
}));

const scope = {
  datasetId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  actor: { type: "user" as const, id: "user-1" },
};
const PLAN = "FeedbackRecords.ed_plan_64879f7d";
const TIER = "FeedbackRecords.ed_tier_0a1b2c3d";

describe("getDatasetFieldMatcher (ADR-0026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockResolvedValue(new Map([[PLAN, "Plan"]]));
  });

  test("every dataset has the shared catalog's dimensions, and no measure or unknown field", async () => {
    const has = await getDatasetFieldMatcher(scope, ["FeedbackRecords.sourceName"]);

    expect(has("FeedbackRecords.sourceName")).toBe(true);
    expect(has("FeedbackRecords.count")).toBe(false);
    expect(has("FeedbackRecords.nope")).toBe(false);
    expect(mockResolve).toHaveBeenCalledWith(scope, []);
  });

  test("an embedded field is the dataset's exactly when the dataset has its key", async () => {
    const has = await getDatasetFieldMatcher(scope, [PLAN, TIER, PLAN, "FeedbackRecords.sourceName"]);

    expect(mockResolve).toHaveBeenCalledWith(scope, [PLAN, TIER]);
    expect(has(PLAN)).toBe(true);
    expect(has(TIER)).toBe(false);
  });
});
