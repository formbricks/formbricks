import { describe, expect, test } from "vitest";
import {
  FEEDBACK_FIELDS,
  formatCubeColumnHeader,
  getFieldById,
  getFilterOperatorsForType,
} from "./schema-definition";

describe("schema-definition", () => {
  describe("getFilterOperatorsForType", () => {
    test("returns string operators", () => {
      const ops = getFilterOperatorsForType("string");
      expect(ops).toContain("equals");
      expect(ops).toContain("contains");
      expect(ops).toContain("set");
    });

    test("returns number operators", () => {
      const ops = getFilterOperatorsForType("number");
      expect(ops).toContain("gt");
      expect(ops).toContain("gte");
      expect(ops).toContain("lt");
      expect(ops).toContain("lte");
    });

    test("returns time operators", () => {
      const ops = getFilterOperatorsForType("time");
      expect(ops).toContain("equals");
      expect(ops).toContain("set");
    });
  });

  describe("getFieldById", () => {
    test("returns dimension by id", () => {
      const field = getFieldById("FeedbackRecords.sentiment");
      expect(field).toBeDefined();
      expect(field?.label).toBe("Sentiment");
      expect(field?.type).toBe("string");
    });

    test("returns measure by id", () => {
      const field = getFieldById("FeedbackRecords.count");
      expect(field).toBeDefined();
      expect(field?.label).toBe("Count");
    });

    test("returns undefined for unknown id", () => {
      expect(getFieldById("Unknown.field")).toBeUndefined();
    });
  });

  describe("formatCubeColumnHeader", () => {
    test("extracts granularity label for time dimension key", () => {
      expect(formatCubeColumnHeader("FeedbackRecords.collectedAt.day")).toBe("Day");
      expect(formatCubeColumnHeader("FeedbackRecords.collectedAt.month")).toBe("Month");
    });

    test("returns field label for known dimension/measure", () => {
      expect(formatCubeColumnHeader("FeedbackRecords.sentiment")).toBe("Sentiment");
      expect(formatCubeColumnHeader("FeedbackRecords.count")).toBe("Count");
    });

    test("converts last segment to title case for unknown keys", () => {
      expect(formatCubeColumnHeader("Some.camelCaseKey")).toBe("Camel Case Key");
    });

    test("handles key with no dots", () => {
      expect(formatCubeColumnHeader("singleKey")).toBe("Single Key");
    });
  });

  describe("FEEDBACK_FIELDS", () => {
    test("has dimensions and measures", () => {
      expect(FEEDBACK_FIELDS.dimensions.length).toBeGreaterThan(0);
      expect(FEEDBACK_FIELDS.measures.length).toBeGreaterThan(0);
    });
  });
});
