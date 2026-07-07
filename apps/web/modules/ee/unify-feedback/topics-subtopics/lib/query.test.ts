import { describe, expect, test } from "vitest";
import type { TaxonomyNode, TaxonomyRun } from "@/modules/hub/types";
import type { TTaxonomyStateResponse } from "./api-client";
import { type TTaxonomyScopeSelection, removeNodeFromStateData, taxonomyKeys } from "./query";

const scope: TTaxonomyScopeSelection = {
  directoryId: "d",
  sourceType: "survey",
  sourceId: "",
  fieldId: "q1",
};

const branch = (id: string, children?: TaxonomyNode[]): TaxonomyNode => ({
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

const makeState = (root: TaxonomyNode | null): TTaxonomyStateResponse => ({
  activeTree: root ? { run: { id: "run" } as TaxonomyRun, root } : null,
  runs: [],
  unavailable: false,
});

describe("taxonomyKeys", () => {
  test("scopes the state key on workspace + scope", () => {
    expect(taxonomyKeys.state("w", scope)).toEqual(["unify-taxonomy", "state", "w", scope]);
  });

  test("node-records key includes node id and limit", () => {
    expect(taxonomyKeys.nodeRecords("w", "d", "n", 100)).toEqual([
      "unify-taxonomy",
      "node-records",
      "w",
      "d",
      "n",
      100,
    ]);
  });
});

describe("removeNodeFromStateData", () => {
  test("removes a nested leaf and keeps its siblings", () => {
    const root = branch("root", [branch("b1", [branch("l1"), branch("l2")]), branch("l3")]);
    const result = removeNodeFromStateData(makeState(root), "l1");
    const b1 = result?.activeTree?.root?.children?.find((child) => child.id === "b1");
    expect(b1?.children?.map((child) => child.id)).toEqual(["l2"]);
  });

  test("removes a whole subtree when a branch is removed", () => {
    const root = branch("root", [branch("b1", [branch("l1")]), branch("l3")]);
    const result = removeNodeFromStateData(makeState(root), "b1");
    expect(result?.activeTree?.root?.children?.map((child) => child.id)).toEqual(["l3"]);
  });

  test("returns the data unchanged when there is no active tree", () => {
    const state = makeState(null);
    expect(removeNodeFromStateData(state, "anything")).toBe(state);
  });
});
