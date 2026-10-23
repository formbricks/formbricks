import { describe, expect, test } from "vitest";
import {
  type TCreativesOperation,
  canWriteCreatives,
  getCreativePatchOperation,
  isCreativesOperationAllowed,
  isCreativesVisible,
} from "./access-rules";

const ALL_OPERATIONS: TCreativesOperation[] = [
  "list",
  "get",
  "stats",
  "create",
  "update",
  "pause",
  "close",
  "delete",
  "archive",
  "restore",
  "duplicate",
];

describe("Creatives access rules (ENG-6602)", () => {
  test("full access allows every operation", () => {
    expect(ALL_OPERATIONS.filter((operation) => isCreativesOperationAllowed("full", operation))).toEqual(
      ALL_OPERATIONS
    );
  });

  test("wind-down allows reading creatives and taking them down, nothing else", () => {
    expect(ALL_OPERATIONS.filter((operation) => isCreativesOperationAllowed("windDown", operation))).toEqual([
      "list",
      "get",
      "stats",
      "pause",
      "close",
      "delete",
    ]);
  });

  test("no access allows nothing", () => {
    expect(ALL_OPERATIONS.filter((operation) => isCreativesOperationAllowed("none", operation))).toEqual([]);
  });

  test("Creatives stay visible, read-only, during wind-down, and only full access writes", () => {
    expect([isCreativesVisible("full"), isCreativesVisible("windDown"), isCreativesVisible("none")]).toEqual([
      true,
      true,
      false,
    ]);
    expect([canWriteCreatives("full"), canWriteCreatives("windDown"), canWriteCreatives("none")]).toEqual([
      true,
      false,
      false,
    ]);
  });

  describe("getCreativePatchOperation", () => {
    test("a status-only patch to paused or completed is a pause or a close", () => {
      expect(getCreativePatchOperation({ status: "paused" })).toBe("pause");
      expect(getCreativePatchOperation({ status: "completed" })).toBe("close");
      expect(getCreativePatchOperation({ status: "completed", name: undefined })).toBe("close");
    });

    test.each([
      [{ status: "inProgress" }],
      [{ status: "draft" }],
      [{ status: "paused", name: "Renamed" }],
      [{ name: "Renamed" }],
      [{}],
    ])("anything else is an update: %j", (body) => {
      expect(getCreativePatchOperation(body)).toBe("update");
    });
  });
});
