import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  type ChartBuilderState,
  type FilterNode,
  buildCubeQuery,
  duplicateFilterNode,
  hasIncompleteFilterRow,
  insertFilterNodeAfter,
  isFilterGroup,
  parseQueryToState,
  removeFilterNode,
  toggleFilterGroupLogic,
  updateFilterRow,
  wrapFilterNodeInGroup,
} from "./query-builder";

const baseState: ChartBuilderState = {
  selectedMeasures: ["FeedbackRecords.count"],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

/** Load a saved query into builder state and serialize it straight back out. */
const roundTrip = (query: TChartQuery): TChartQuery =>
  buildCubeQuery({ ...baseState, ...parseQueryToState(query) });

/** Compare filter trees without the generated node ids. */
const stripIds = (nodes: FilterNode[]): unknown[] =>
  nodes.map((node) =>
    isFilterGroup(node)
      ? { logic: node.logic, children: stripIds(node.children) }
      : { field: node.field, operator: node.operator, values: node.values }
  );

describe("query-builder", () => {
  describe("buildCubeQuery", () => {
    test("builds minimal query with measures only", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [],
        filterLogic: "and",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.measures).toEqual(["FeedbackRecords.count"]);
      expect(query.dimensions).toBeUndefined();
      expect(query.timeDimensions).toBeUndefined();
      expect(query.filters).toBeUndefined();
    });

    test("adds dimensions when present", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: ["FeedbackRecords.userId"],
        filters: [],
        filterLogic: "and",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.dimensions).toEqual(["FeedbackRecords.userId"]);
    });

    test("adds time dimension with string dateRange", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [],
        filterLogic: "and",
        timeDimension: {
          dimension: "FeedbackRecords.collectedAt",
          granularity: "day",
          dateRange: "last 30 days",
        },
      };
      const query = buildCubeQuery(config);
      expect(query.timeDimensions).toEqual([
        { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 30 days" },
      ]);
    });

    test("adds time dimension without granularity (filter only)", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [],
        filterLogic: "and",
        timeDimension: {
          dimension: "FeedbackRecords.collectedAt",
          dateRange: "last 30 days",
        },
      };
      const query = buildCubeQuery(config);
      expect(query.timeDimensions).toEqual([
        { dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" },
      ]);
    });

    test("adds time dimension with Date array dateRange", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [],
        filterLogic: "and",
        timeDimension: {
          dimension: "FeedbackRecords.collectedAt",
          granularity: "month",
          dateRange: [new Date("2024-01-15"), new Date("2024-06-20")],
        },
      };
      const query = buildCubeQuery(config);
      expect(query.timeDimensions).toEqual([
        {
          dimension: "FeedbackRecords.collectedAt",
          granularity: "month",
          dateRange: ["2024-01-15", "2024-06-20"],
        },
      ]);
    });

    test("adds AND filters as member filters", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [
          { id: "f1", field: "FeedbackRecords.userId", operator: "equals", values: ["positive"] },
          { id: "f2", field: "FeedbackRecords.sourceType", operator: "set", values: null },
        ],
        filterLogic: "and",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.filters).toEqual([
        { member: "FeedbackRecords.userId", operator: "equals", values: ["positive"] },
        { member: "FeedbackRecords.sourceType", operator: "set" },
      ]);
    });

    test("swaps FeedbackRecords.valueText to FeedbackRecords.valueId when groupByOptionId is true", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: ["FeedbackRecords.valueText"],
        filters: [{ id: "f1", field: "FeedbackRecords.fieldId", operator: "equals", values: ["el-gender"] }],
        filterLogic: "and",
        timeDimension: null,
        groupByOptionId: true,
      };
      const query = buildCubeQuery(config);
      expect(query.dimensions).toEqual(["FeedbackRecords.valueId"]);
    });

    test("leaves dimensions unchanged when groupByOptionId is false", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: ["FeedbackRecords.valueText"],
        filters: [],
        filterLogic: "and",
        timeDimension: null,
        groupByOptionId: false,
      };
      const query = buildCubeQuery(config);
      expect(query.dimensions).toEqual(["FeedbackRecords.valueText"]);
    });

    test("leaves dimensions unchanged when groupByOptionId is true but valueText not present", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: ["FeedbackRecords.userId"],
        filters: [],
        filterLogic: "and",
        timeDimension: null,
        groupByOptionId: true,
      };
      const query = buildCubeQuery(config);
      expect(query.dimensions).toEqual(["FeedbackRecords.userId"]);
    });

    test("adds OR filters wrapped in or", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: [],
        filters: [{ id: "f1", field: "FeedbackRecords.userId", operator: "equals", values: ["positive"] }],
        filterLogic: "or",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.filters).toEqual([
        {
          or: [{ member: "FeedbackRecords.userId", operator: "equals", values: ["positive"] }],
        },
      ]);
    });

    test("serializes a condition ANDed with a group of ORed conditions", () => {
      const query = buildCubeQuery({
        ...baseState,
        filters: [
          { id: "f1", field: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          {
            id: "g1",
            logic: "or",
            children: [
              { id: "f2", field: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
              { id: "f3", field: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_After"] },
            ],
          },
        ],
      });

      // Top level stays a flat AND list so Cube's appended tenant filter ANDs with the whole thing.
      expect(query.filters).toEqual([
        { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
        {
          or: [
            { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
            { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_After"] },
          ],
        },
      ]);
    });

    test("wraps the whole expression in a single node when the top-level logic is OR", () => {
      const query = buildCubeQuery({
        ...baseState,
        filterLogic: "or",
        filters: [
          { id: "f1", field: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          {
            id: "g1",
            logic: "and",
            children: [
              { id: "f2", field: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
            ],
          },
        ],
      });

      expect(query.filters).toHaveLength(1);
      expect(query.filters?.[0]).toEqual({
        or: [
          { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          { and: [{ member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] }] },
        ],
      });
    });

    test("prunes empty groups instead of emitting { and: [] } / { or: [] }", () => {
      const query = buildCubeQuery({
        ...baseState,
        filters: [
          { id: "f1", field: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          { id: "g1", logic: "or", children: [] },
          { id: "g2", logic: "and", children: [{ id: "g3", logic: "or", children: [] }] },
        ],
      });

      expect(query.filters).toEqual([
        { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
      ]);
    });

    test("omits filters entirely when every node prunes away", () => {
      const query = buildCubeQuery({
        ...baseState,
        filterLogic: "or",
        filters: [{ id: "g1", logic: "or", children: [] }],
      });

      expect(query.filters).toBeUndefined();
    });
  });

  describe("parseQueryToState", () => {
    test("parses minimal query", () => {
      const state = parseQueryToState({ measures: ["FeedbackRecords.count"] });
      expect(state.selectedMeasures).toEqual(["FeedbackRecords.count"]);
      expect(state.selectedDimensions).toEqual([]);
      expect(state.filters).toEqual([]);
      expect(state.filterLogic).toBe("and");
      expect(state.timeDimension).toBeNull();
    });

    test("parses AND member filters", () => {
      const query = {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.userId", operator: "equals", values: ["positive"] }],
      };
      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("and");
      expect(stripIds(state.filters ?? [])).toEqual([
        { field: "FeedbackRecords.userId", operator: "equals", values: ["positive"] },
      ]);
    });

    test("parses OR filters", () => {
      const query = {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            or: [{ member: "FeedbackRecords.userId", operator: "equals", values: ["positive"] }],
          },
        ],
      };
      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("or");
      expect(stripIds(state.filters ?? [])).toEqual([
        { field: "FeedbackRecords.userId", operator: "equals", values: ["positive"] },
      ]);
    });

    test("parses time dimension with granularity and dateRange", () => {
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "day",
            dateRange: "last 30 days",
          },
        ],
      };
      const state = parseQueryToState(query);
      expect(state.timeDimension).toEqual({
        dimension: "FeedbackRecords.collectedAt",
        granularity: "day",
        dateRange: "last 30 days",
      });
    });

    test("parses time dimension without granularity (filter only)", () => {
      const query = {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            dateRange: "last 30 days",
          },
        ],
      };
      const state = parseQueryToState(query);
      expect(state.timeDimension).toEqual({
        dimension: "FeedbackRecords.collectedAt",
        dateRange: "last 30 days",
      });
    });

    test("parses a nested group into a group node instead of dropping it", () => {
      const state = parseQueryToState({
        measures: ["FeedbackRecords.count"],
        filters: [
          { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          {
            or: [
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_After"] },
            ],
          },
        ],
      });

      expect(state.filterLogic).toBe("and");
      expect(state.filters).toHaveLength(2);

      const [condition, group] = state.filters as FilterNode[];
      expect(isFilterGroup(condition)).toBe(false);
      if (!isFilterGroup(group)) throw new Error("expected a group node");
      expect(group.logic).toBe("or");
      expect(group.children.map((child) => (isFilterGroup(child) ? null : child.values))).toEqual([
        ["PAF_Pre"],
        ["PAF_After"],
      ]);
    });
  });

  describe("round-trip", () => {
    test("buildCubeQuery then parseQueryToState restores state", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        selectedDimensions: ["FeedbackRecords.userId"],
        filters: [{ id: "f1", field: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
        filterLogic: "and",
        timeDimension: {
          dimension: "FeedbackRecords.collectedAt",
          granularity: "week",
          dateRange: "last 7 days",
        },
      };
      const query = buildCubeQuery(config);
      const restored = parseQueryToState(query);

      expect(restored.selectedMeasures).toEqual(config.selectedMeasures);
      expect(restored.selectedDimensions).toEqual(config.selectedDimensions);
      expect(restored.filterLogic).toBe(config.filterLogic);
      expect(restored.timeDimension).toEqual(config.timeDimension);
      expect(stripIds(restored.filters ?? [])).toEqual(stripIds(config.filters));
    });

    test("keeps a saved nested group through load and save", () => {
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        filters: [
          { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          {
            or: [
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_After"] },
            ],
          },
        ],
      };

      expect(roundTrip(query).filters).toEqual(query.filters);
    });

    test("keeps nesting deeper than the builder UI creates", () => {
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            and: [
              { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
              {
                or: [
                  { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
                  { and: [{ member: "FeedbackRecords.language", operator: "set" }] },
                ],
              },
            ],
          },
        ],
      };

      expect(roundTrip(query).filters).toEqual(query.filters);
    });

    test("legacy flat filter array (implicit AND) round-trips unchanged", () => {
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        filters: [
          { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          { member: "FeedbackRecords.sourceType", operator: "set" },
        ],
      };

      expect(roundTrip(query).filters).toEqual(query.filters);
    });

    test("legacy single-OR shape round-trips unchanged and still reads as a flat OR list", () => {
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            or: [
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_After"] },
            ],
          },
        ],
      };

      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("or");
      expect(state.filters?.every((node) => !isFilterGroup(node))).toBe(true);
      expect(roundTrip(query).filters).toEqual(query.filters);
    });

    test("draws a saved top-level OR containing a group the way it was built", () => {
      // `A OR (B AND C)`. The lone-OR lift used to require every child to be a plain condition, so
      // this fell through to the general path and came back as one OR group wrapping an AND group —
      // the same expression, drawn differently from what the user built.
      const query: TChartQuery = {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            or: [
              { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
              {
                and: [
                  { member: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
                  { member: "FeedbackRecords.language", operator: "equals", values: ["en"] },
                ],
              },
            ],
          },
        ],
      };

      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("or");
      expect(state.filters).toHaveLength(2);
      expect(state.filters?.map(isFilterGroup)).toEqual([false, true]);
      expect(roundTrip(query).filters).toEqual(query.filters);
    });

    test("drops a filter node the builder cannot represent instead of throwing", () => {
      // Cube's legacy `dimension` alias for `member`, or a hand-edited row: neither a member filter
      // nor a well-formed and/or. The flat parser this replaced skipped such nodes; parsing must not
      // crash the whole builder over one.
      const query = {
        measures: ["FeedbackRecords.count"],
        filters: [
          { dimension: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
          { member: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
        ],
      } as unknown as TChartQuery;

      expect(() => parseQueryToState(query)).not.toThrow();
      expect(parseQueryToState(query).filters).toHaveLength(1);
    });

    test("treats an empty OR as no filter at all rather than a top-level OR of nothing", () => {
      const query = {
        measures: ["FeedbackRecords.count"],
        filters: [{ or: [] }],
      } as unknown as TChartQuery;

      const state = parseQueryToState(query);
      expect(state.filters).toEqual([]);
      expect(roundTrip(query).filters).toBeUndefined();
    });
  });

  describe("filter tree editing", () => {
    const conditionA: FilterNode = {
      id: "a",
      field: "FeedbackRecords.fieldType",
      operator: "equals",
      values: ["ces"],
    };
    const group: FilterNode = {
      id: "g1",
      logic: "or",
      children: [{ id: "b", field: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] }],
    };

    test("inserts a condition right below the addressed one, inside its group", () => {
      const next = insertFilterNodeAfter([conditionA, group], "b", {
        id: "c",
        field: "FeedbackRecords.sourceName",
        operator: "equals",
        values: ["PAF_After"],
      });

      const target = next[1];
      if (!isFilterGroup(target)) throw new Error("expected a group node");
      expect(target.children.map((child) => child.id)).toEqual(["b", "c"]);
      expect(next).toHaveLength(2);
    });

    test("inserts below a top-level condition, before the group that follows it", () => {
      const next = insertFilterNodeAfter([conditionA, group], "a", {
        id: "z",
        field: "x",
        operator: "set",
        values: null,
      });
      expect(next.map((node) => node.id)).toEqual(["a", "z", "g1"]);
    });

    test("duplicates a nested condition below itself with a fresh id", () => {
      const next = duplicateFilterNode([conditionA, group], "b");
      const target = next[1];
      if (!isFilterGroup(target)) throw new Error("expected a group node");
      expect(target.children).toHaveLength(2);
      expect(target.children[1]).toMatchObject({ field: "FeedbackRecords.sourceName", values: ["PAF_Pre"] });
      expect(target.children[1].id).not.toBe("b");
    });

    test("wraps a condition in a group that flips the surrounding logic", () => {
      const next = wrapFilterNodeInGroup([conditionA, group], "a", "and");
      const wrapped = next[0];
      if (!isFilterGroup(wrapped)) throw new Error("expected a group node");
      expect(wrapped.logic).toBe("or");
      expect(wrapped.children).toEqual([conditionA]);
      expect(next[1]).toEqual(group);
    });

    test("wraps a nested condition against its own group's logic, not the top level's", () => {
      const next = wrapFilterNodeInGroup([conditionA, group], "b", "and");
      const outer = next[1];
      if (!isFilterGroup(outer)) throw new Error("expected a group node");
      const inner = outer.children[0];
      if (!isFilterGroup(inner)) throw new Error("expected a nested group node");
      expect(inner.logic).toBe("and");
    });

    test("updates a condition nested in a group and clears values for valueless operators", () => {
      const next = updateFilterRow([conditionA, group], "b", { operator: "notSet" });
      const target = next[1];
      if (!isFilterGroup(target)) throw new Error("expected a group node");
      expect(target.children[0]).toMatchObject({ operator: "notSet", values: null });
    });

    test("flips the logic of a group without touching its siblings", () => {
      const next = toggleFilterGroupLogic([conditionA, group], "g1");
      const target = next[1];
      if (!isFilterGroup(target)) throw new Error("expected a group node");
      expect(target.logic).toBe("and");
      expect(next[0]).toBe(conditionA);
    });

    test("drops a group left empty by removing its last condition", () => {
      expect(removeFilterNode([conditionA, group], "b")).toEqual([conditionA]);
    });

    test("removes a whole group by its own id", () => {
      expect(removeFilterNode([conditionA, group], "g1")).toEqual([conditionA]);
    });
  });

  describe("hasIncompleteFilterRow", () => {
    test("reports a half-filled condition nested in a group", () => {
      expect(
        hasIncompleteFilterRow([
          { id: "a", field: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
          {
            id: "g1",
            logic: "or",
            children: [{ id: "b", field: "FeedbackRecords.sourceName", operator: "equals", values: null }],
          },
        ])
      ).toBe(true);
    });

    test("treats valueless operators and empty groups as complete", () => {
      expect(
        hasIncompleteFilterRow([
          { id: "a", field: "FeedbackRecords.sourceType", operator: "set", values: null },
          { id: "g1", logic: "or", children: [] },
        ])
      ).toBe(false);
    });
  });
});
