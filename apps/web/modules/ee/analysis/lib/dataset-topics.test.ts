import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TaxonomyNode } from "@/modules/hub/types";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { collectTopicLabels, getDatasetTopics, invalidateDatasetTopics } from "./dataset-topics";

const mocks = vi.hoisted(() => ({
  getIsFeedbackDirectoriesEnabled: vi.fn(),
  getActiveTaxonomyTree: vi.fn(),
  withCache: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: mocks.getIsFeedbackDirectoriesEnabled,
}));
vi.mock("@/modules/hub/service", () => ({ getActiveTaxonomyTree: mocks.getActiveTaxonomyTree }));
vi.mock("@/lib/cache", () => ({ cache: { withCache: mocks.withCache, del: mocks.del } }));

let nextId = 0;
const node = (
  nodeType: TaxonomyNode["node_type"],
  label: string,
  children: TaxonomyNode[] = [],
  extra: Partial<TaxonomyNode> = {}
): TaxonomyNode => ({
  id: `node-${String(nextId++)}`,
  run_id: "run-1",
  node_type: nodeType,
  label,
  level: 0,
  sort_order: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  children,
  ...extra,
});
const leaf = (label: string, extra: Partial<TaxonomyNode> = {}) => node("leaf", label, [], extra);
/** A topic with its subtopics, each holding one level-3 node and the given leaves. */
const topic = (label: string, subtopics: Record<string, TaxonomyNode[]>, extra: Partial<TaxonomyNode> = {}) =>
  node(
    "branch",
    label,
    Object.entries(subtopics).map(([subtopic, leaves]) =>
      node("branch", subtopic, [node("branch", `${subtopic} detail`, leaves)])
    ),
    extra
  );
const removed = { removed_at: "2026-11-02T00:00:00Z" };

const SCOPE = { datasetId: "dir-1", organizationId: "org-1" };

describe("collectTopicLabels", () => {
  test("lists level-1 topics and level-2 subtopics, written 'Topic › Subtopic', sorted", () => {
    const root = node("root", "Feedback", [
      topic("Login", { "Password reset": [leaf("Reset email")] }),
      topic("Billing", { Refunds: [leaf("Late refund")], Invoices: [leaf("Wrong VAT")] }),
    ]);

    expect(collectTopicLabels(root)).toEqual({
      topics: ["Billing", "Login"],
      subtopics: ["Billing › Invoices", "Billing › Refunds", "Login › Password reset"],
    });
  });

  test("leaves out removed nodes, and everything under them", () => {
    const root = node("root", "Feedback", [
      topic("Billing", { Refunds: [leaf("Late refund")] }, removed),
      topic("Login", { "Password reset": [leaf("Reset email")], Lockout: [leaf("Locked", removed)] }),
    ]);

    expect(collectTopicLabels(root)).toEqual({ topics: ["Login"], subtopics: ["Login › Password reset"] });
  });

  test("leaves out a branch that only holds the outlier leaf, even after it was renamed", () => {
    const root = node("root", "Feedback", [
      topic("Uncategorized", { "Uncategorized Feedback": [leaf("Uncategorized Feedback")] }),
      topic("Other", {
        Misc: [leaf("Odds and ends", { original_label: "Uncategorized Feedback" })],
        Shipping: [leaf("Late parcel"), leaf("Uncategorized Feedback")],
      }),
    ]);

    // "Other › Shipping" keeps its place: it has a classified leaf next to the outlier.
    expect(collectTopicLabels(root)).toEqual({ topics: ["Other"], subtopics: ["Other › Shipping"] });
  });

  test("has no labels without a tree", () => {
    expect(collectTopicLabels(null)).toEqual({ topics: [], subtopics: [] });
  });
});

describe("getDatasetTopics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValue(true);
    mocks.withCache.mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  test("answers the active directory taxonomy's labels, cached per directory for a minute", async () => {
    mocks.getActiveTaxonomyTree.mockResolvedValue({
      data: { run: {}, root: node("root", "Feedback", [topic("Billing", { Refunds: [leaf("x")] })]) },
      error: null,
    });

    await expect(getDatasetTopics(SCOPE)).resolves.toEqual({
      status: "active",
      labels: { topics: ["Billing"], subtopics: ["Billing › Refunds"] },
    });
    expect(mocks.getActiveTaxonomyTree).toHaveBeenCalledWith({ tenant_id: "dir-1", scope_type: "directory" });
    expect(mocks.withCache).toHaveBeenCalledWith(
      expect.any(Function),
      "fb:hub:dir-1:directory_topic_labels",
      60_000
    );
  });

  test("is forbidden without the Feedback Directories feature, and does not ask Hub", async () => {
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValue(false);

    await expect(getDatasetTopics(SCOPE)).resolves.toEqual({ status: "forbidden" });
    expect(mocks.getActiveTaxonomyTree).not.toHaveBeenCalled();
  });

  test.each([
    ["no active taxonomy", { status: 404, message: "404 not found" }],
    ["Hub not set up on this deployment", { ...NO_CONFIG_ERROR }],
  ])("is inactive with %s", async (_label, error) => {
    mocks.getActiveTaxonomyTree.mockResolvedValue({ data: null, error });

    await expect(getDatasetTopics(SCOPE)).resolves.toEqual({ status: "inactive" });
  });

  test.each([
    ["a Hub error", { status: 500, message: "500 boom" }],
    // No status, like a missing config, but a dead socket rather than a switched-off Hub.
    ["an unreachable Hub", { status: 0, message: "fetch failed" }],
  ])("is unavailable on %s, which is not cached", async (_label, error) => {
    let cachedValue: unknown;
    mocks.withCache.mockImplementation(async (fn: () => Promise<unknown>) => {
      cachedValue = await fn();
      return cachedValue;
    });
    mocks.getActiveTaxonomyTree.mockResolvedValue({ data: null, error });

    await expect(getDatasetTopics(SCOPE)).resolves.toEqual({ status: "unavailable" });
    expect(cachedValue).toBeUndefined();
  });
});

describe("invalidateDatasetTopics", () => {
  test("drops the directory's cached labels", async () => {
    mocks.del.mockResolvedValue({ ok: true, data: undefined });

    await invalidateDatasetTopics("dir-1");
    expect(mocks.del).toHaveBeenCalledWith(["fb:hub:dir-1:directory_topic_labels"]);
  });
});
