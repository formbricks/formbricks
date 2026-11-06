import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEmbeddedKeysForQuery } from "./dataset-embedded-keys";
import { getEmbeddedMemberName } from "./embedded-member-name";
import { createRequestEmbeddedKeys } from "./request-embedded-keys";

vi.mock("server-only", () => ({}));
// The unit setup fakes hashing; member names carry a hash, so hash for real.
vi.mock("node:crypto", async (importOriginal) => await importOriginal());
vi.mock("./dataset-embedded-keys", () => ({ getEmbeddedKeysForQuery: vi.fn() }));

const scopeOf = (datasetId: string) => ({
  datasetId,
  workspaceId: "ws",
  organizationId: "org",
  actor: { type: "user" as const, id: "user_1" },
});
const PLAN = getEmbeddedMemberName("Plan");
const REGION = getEmbeddedMemberName("Region");
const query = (...members: string[]) => ({
  dimensions: ["FeedbackRecords.sourceName"],
  filters: members.map((member) => ({ member, operator: "set" })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEmbeddedKeysForQuery).mockImplementation(async (scope) => [`keys-of-${scope.datasetId}`]);
});

describe("createRequestEmbeddedKeys", () => {
  test("resolves a dataset's keys once for every query naming the same embedded fields", async () => {
    const keysFor = createRequestEmbeddedKeys(scopeOf);

    const resolved = await Promise.all([
      keysFor("ds_a", query(PLAN)),
      keysFor("ds_a", query(PLAN, PLAN)),
      keysFor("ds_a", {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: PLAN, operator: "equals", values: ["x"] }],
      }),
    ]);

    expect(getEmbeddedKeysForQuery).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual([["keys-of-ds_a"], ["keys-of-ds_a"], ["keys-of-ds_a"]]);
  });

  test("resolves again for other embedded fields or another dataset", async () => {
    const keysFor = createRequestEmbeddedKeys(scopeOf);

    await keysFor("ds_a", query(PLAN));
    await keysFor("ds_a", query(REGION));
    await keysFor("ds_a", query());
    await keysFor("ds_b", query(PLAN));

    expect(getEmbeddedKeysForQuery).toHaveBeenCalledTimes(4);
  });

  test("keeps nothing between requests", async () => {
    await createRequestEmbeddedKeys(scopeOf)("ds_a", query(PLAN));
    await createRequestEmbeddedKeys(scopeOf)("ds_a", query(PLAN));

    expect(getEmbeddedKeysForQuery).toHaveBeenCalledTimes(2);
  });
});
