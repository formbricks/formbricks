import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { getWorkflowRunStatusBadge, getWorkflowStatusBadge, getWorkflowTriggerTypeLabel } from "./display";

// Identity translator so assertions can check the i18n key each helper resolves.
const t = ((key: string) => key) as unknown as TFunction;

describe("getWorkflowStatusBadge", () => {
  test.each([
    ["enabled", "common.enabled", "success"],
    ["disabled", "common.disabled", "gray"],
    ["archived", "common.archived", "gray"],
    ["draft", "common.draft", "gray"],
  ] as const)("maps %s to label %s / type %s", (status, label, type) => {
    expect(getWorkflowStatusBadge(status, t)).toEqual({ label, type });
  });
});

describe("getWorkflowRunStatusBadge", () => {
  test.each([
    ["completed", "common.completed", "success"],
    ["failed", "common.failed", "error"],
    ["running", "common.running", "warning"],
    ["canceled", "common.canceled", "gray"],
    ["queued", "common.queued", "gray"],
  ] as const)("maps %s to label %s / type %s", (status, label, type) => {
    expect(getWorkflowRunStatusBadge(status, t)).toEqual({ label, type });
  });
});

describe("getWorkflowTriggerTypeLabel", () => {
  test("maps response.completed to its label key", () => {
    expect(getWorkflowTriggerTypeLabel("response.completed", t)).toBe("common.response_completed");
  });
});
