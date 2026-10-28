import { describe, expect, test } from "vitest";
import {
  ZV3DocumentPushBody,
  buildDocumentEnvelope,
  diffDocuments,
  problemDestructiveChange,
  problemStaleDocument,
} from "./envelope";

describe("diffDocuments", () => {
  test("reports nothing for equal documents", () => {
    expect(diffDocuments({ name: "a", tags: [1, 2] }, { name: "a", tags: [1, 2] })).toEqual([]);
  });

  test("reports added, removed and changed top-level keys in a stable order", () => {
    expect(diffDocuments({ b: 1, c: 1, a: 1 }, { a: 2, b: 1, d: 1 })).toEqual([
      { path: "a", change: "changed" },
      { path: "c", change: "removed" },
      { path: "d", change: "added" },
    ]);
  });

  test("addresses members of an array of id objects by id instead of reporting the whole array", () => {
    const before = { blocks: [{ id: "b1", text: "x" }, { id: "b2", text: "y" }, { id: "b3" }] };
    const after = { blocks: [{ id: "b1", text: "x" }, { id: "b2", text: "changed" }, { id: "b4" }] };

    expect(diffDocuments(before, after)).toEqual([
      { path: "blocks[b2]", change: "changed" },
      { path: "blocks[b4]", change: "added" },
      { path: "blocks[b3]", change: "removed" },
    ]);
  });

  test("a reordered id array is still a change", () => {
    expect(
      diffDocuments({ blocks: [{ id: "a" }, { id: "b" }] }, { blocks: [{ id: "b" }, { id: "a" }] })
    ).toEqual([{ path: "blocks", change: "changed" }]);
  });

  test("an array without ids is reported whole", () => {
    expect(diffDocuments({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual([
      { path: "tags", change: "changed" },
    ]);
  });
});

describe("push body", () => {
  const valid = {
    schemaVersion: 1,
    expectedUpdatedAt: "2026-10-28T12:00:00.000Z",
    document: { name: "x" },
  };

  test("requires the updatedAt the document was pulled at", () => {
    expect(ZV3DocumentPushBody.safeParse(valid).success).toBe(true);
    const { expectedUpdatedAt: _omit, ...withoutIt } = valid;
    expect(ZV3DocumentPushBody.safeParse(withoutIt).success).toBe(false);
  });

  test("refuses another schema version and any undeclared key", () => {
    expect(ZV3DocumentPushBody.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
    expect(ZV3DocumentPushBody.safeParse({ ...valid, status: "inProgress" }).success).toBe(false);
  });
});

describe("conflict problems", () => {
  test("a stale push answers 409 with both timestamps", async () => {
    const response = problemStaleDocument("req_1", "2026-10-28T12:00:00.000Z", "2026-10-28T13:00:00.000Z");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("conflict");
    expect(body.details).toEqual({
      expectedUpdatedAt: "2026-10-28T12:00:00.000Z",
      currentUpdatedAt: "2026-10-28T13:00:00.000Z",
    });
  });

  test("an unconfirmed destructive push answers 409 naming what would go", async () => {
    const response = problemDestructiveChange("req_1", [
      { type: "blocks_removed", ids: ["b1"], responseCount: 12 },
    ]);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.details).toEqual({
      reason: "destructive_change",
      changes: [{ type: "blocks_removed", ids: ["b1"], responseCount: 12 }],
    });
  });
});

describe("buildDocumentEnvelope", () => {
  test("stamps the kind and schema version and carries the stale-check handle", () => {
    expect(
      buildDocumentEnvelope(
        "workflow",
        { id: "w1", workspaceId: "ws1", updatedAt: "2026-10-28T12:00:00.000Z" },
        { name: "n" }
      )
    ).toEqual({
      kind: "workflow",
      schemaVersion: 1,
      id: "w1",
      workspaceId: "ws1",
      updatedAt: "2026-10-28T12:00:00.000Z",
      document: { name: "n" },
    });
  });
});
