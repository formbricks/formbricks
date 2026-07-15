import { describe, expect, test } from "vitest";
import type { TaxonomyNode } from "@/modules/hub/types";
import { findNodeById, firstTopLevelNodeId } from "./tree";

const node = (id: string, children?: TaxonomyNode[]): TaxonomyNode => ({
  id,
  run_id: "run",
  node_type: children ? "branch" : "leaf",
  label: id,
  level: 1,
  sort_order: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  ...(children ? { children } : {}),
});

const tree = node("root", [node("topic-1", [node("sub-1"), node("sub-2")]), node("topic-2")]);

describe("findNodeById", () => {
  test("returns the root node when its id matches", () => {
    expect(findNodeById(tree, "root")).toBe(tree);
  });

  test("finds a deeply nested descendant", () => {
    expect(findNodeById(tree, "sub-2")?.id).toBe("sub-2");
  });

  test("returns null when no node has the id", () => {
    expect(findNodeById(tree, "missing")).toBeNull();
  });

  test("returns null for a missing root or a null id", () => {
    expect(findNodeById(null, "root")).toBeNull();
    expect(findNodeById(undefined, "root")).toBeNull();
    expect(findNodeById(tree, null)).toBeNull();
  });
});

describe("firstTopLevelNodeId", () => {
  test("returns the id of the root's first child", () => {
    expect(firstTopLevelNodeId(tree)).toBe("topic-1");
  });

  test("returns null when the root has no children or is missing", () => {
    expect(firstTopLevelNodeId(node("lonely"))).toBeNull();
    expect(firstTopLevelNodeId(null)).toBeNull();
    expect(firstTopLevelNodeId(undefined)).toBeNull();
  });
});
