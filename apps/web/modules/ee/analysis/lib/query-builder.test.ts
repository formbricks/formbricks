import { describe, expect, test } from "vitest";
import { type ChartBuilderState, buildCubeQuery, parseQueryToState } from "./query-builder";

describe("query-builder", () => {
  describe("buildCubeQuery", () => {
    test("builds minimal query with measures only", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        customMeasures: [],
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
        customMeasures: [],
        selectedDimensions: ["FeedbackRecords.sentiment"],
        filters: [],
        filterLogic: "and",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.dimensions).toEqual(["FeedbackRecords.sentiment"]);
    });

    test("adds time dimension with string dateRange", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        customMeasures: [],
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

    test("adds time dimension with Date array dateRange", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        customMeasures: [],
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
        customMeasures: [],
        selectedDimensions: [],
        filters: [
          { field: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
          { field: "FeedbackRecords.sourceType", operator: "set", values: null },
        ],
        filterLogic: "and",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.filters).toEqual([
        { member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
        { member: "FeedbackRecords.sourceType", operator: "set" },
      ]);
    });

    test("adds OR filters wrapped in or", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        customMeasures: [],
        selectedDimensions: [],
        filters: [{ field: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] }],
        filterLogic: "or",
        timeDimension: null,
      };
      const query = buildCubeQuery(config);
      expect(query.filters).toEqual([
        {
          or: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] }],
        },
      ]);
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
        filters: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] }],
      };
      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("and");
      expect(state.filters).toEqual([
        { field: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
      ]);
    });

    test("parses OR filters", () => {
      const query = {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            or: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] }],
          },
        ],
      };
      const state = parseQueryToState(query);
      expect(state.filterLogic).toBe("or");
      expect(state.filters).toEqual([
        { field: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
      ]);
    });

    test("parses time dimension with granularity and dateRange", () => {
      const query = {
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
  });

  describe("round-trip", () => {
    test("buildCubeQuery then parseQueryToState restores state", () => {
      const config: ChartBuilderState = {
        selectedMeasures: ["FeedbackRecords.count"],
        customMeasures: [],
        selectedDimensions: ["FeedbackRecords.sentiment"],
        filters: [{ field: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
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
      expect(restored.filters).toEqual(config.filters);
    });
  });
});
