import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { markTierFailed, readState, recordSurvey, resetState, updateState } from "./run-state.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dc-state-"));
  process.env.DEPLOYMENT_CHECK_STATE_FILE = join(dir, "nested", "state.json");
});

afterEach(() => {
  delete process.env.DEPLOYMENT_CHECK_STATE_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe("run state", () => {
  test("reads as empty when no run has started", () => {
    expect(readState()).toEqual({ surveyIds: [], failedTiers: [] });
  });

  test("falls back to empty when the file is corrupt, so a crash cannot block teardown", () => {
    resetState();
    writeFileSync(process.env.DEPLOYMENT_CHECK_STATE_FILE as string, "{not json");

    expect(readState()).toEqual({ surveyIds: [], failedTiers: [] });
  });

  test("resetState clears an earlier run", () => {
    recordSurvey("old");
    resetState();

    expect(readState().surveyIds).toEqual([]);
  });

  test("records surveys in order and persists across reads", () => {
    recordSurvey("a");
    recordSurvey("b");

    expect(readState().surveyIds).toEqual(["a", "b"]);
  });

  test("marks a tier failed once", () => {
    markTierFailed("infra");
    markTierFailed("infra");

    expect(readState().failedTiers).toEqual(["infra"]);
  });

  test("keeps unrelated fields when updating one", () => {
    recordSurvey("a");
    updateState((state) => {
      state.workspaceId = "ws";
    });

    expect(readState()).toMatchObject({ surveyIds: ["a"], workspaceId: "ws" });
  });
});
