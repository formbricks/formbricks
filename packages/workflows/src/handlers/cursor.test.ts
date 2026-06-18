import { describe, expect, test } from "vitest";
import { WorkflowInvalidInputError } from "../errors";
import { buildNextWorkflowListCursor, decodeWorkflowListCursor, encodeWorkflowListCursor } from "./cursor";

const row = {
  id: "cm9zr4t2b000208l8h2m1aq3c",
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  name: "Alpha workflow",
};

describe("workflow list cursor", () => {
  test.each(["createdAt", "updatedAt", "name"] as const)("round-trips a %s cursor", (sortBy) => {
    const cursor = buildNextWorkflowListCursor(row, sortBy);
    const encoded = encodeWorkflowListCursor(cursor);
    expect(decodeWorkflowListCursor(encoded, sortBy)).toEqual(cursor);
  });

  test("rejects a cursor issued for a different sort order", () => {
    const encoded = encodeWorkflowListCursor(buildNextWorkflowListCursor(row, "name"));
    expect(() => decodeWorkflowListCursor(encoded, "createdAt")).toThrow(WorkflowInvalidInputError);
  });

  test("rejects a malformed cursor", () => {
    expect(() => decodeWorkflowListCursor("@@not-valid@@", "updatedAt")).toThrow(WorkflowInvalidInputError);
  });
});
