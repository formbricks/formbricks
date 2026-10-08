import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TRetentionRun } from "../types";
import { getRetentionHistoryCounts, getRetentionPolicyLabel } from "./display";

const run = (policy: TRetentionRun["policy"]): TRetentionRun => ({
  id: "run_1",
  policy,
  startedAt: "2030-01-01T02:00:00.000Z",
  finishedAt: null,
  notified: 3,
  archived: 5,
  deleted: 7,
  skipped: 1,
});

describe("getRetentionHistoryCounts", () => {
  test("responses send no notices and have no archive, so only deletions show", () => {
    expect(getRetentionHistoryCounts(run("responses"))).toEqual({
      notified: null,
      archived: null,
      deletedOrDeactivated: 7,
    });
  });

  test("surveys show notices, archives and deletions", () => {
    expect(getRetentionHistoryCounts(run("surveys"))).toEqual({
      notified: 3,
      archived: 5,
      deletedOrDeactivated: 7,
    });
  });

  test("members' deactivations, which the API reports as archived, go in the last column", () => {
    expect(getRetentionHistoryCounts(run("members"))).toEqual({
      notified: 3,
      archived: null,
      deletedOrDeactivated: 5,
    });
  });

  test("keeps a real zero rather than showing it as missing", () => {
    expect(getRetentionHistoryCounts({ ...run("surveys"), archived: 0 }).archived).toBe(0);
  });
});

describe("getRetentionPolicyLabel", () => {
  test("uses the shared labels for each kind of data", () => {
    const t = ((key: string) => key) as unknown as TFunction;

    expect(getRetentionPolicyLabel("responses", t)).toBe("common.responses");
    expect(getRetentionPolicyLabel("surveys", t)).toBe("common.surveys");
    expect(getRetentionPolicyLabel("members", t)).toBe("common.members");
  });
});
