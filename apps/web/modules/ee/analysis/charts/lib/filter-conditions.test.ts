import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { FilterNode } from "@/modules/ee/analysis/lib/query-builder";
import { EMOTIONS_DIMENSION_ID } from "@/modules/ee/analysis/lib/schema-definition";
import {
  CHART_FILTER_ROOT_ID,
  getDefaultFilterOperator,
  getFilterFieldOptions,
  getFilterFieldType,
  toConditionGroup,
  toFilterRowUpdates,
} from "./filter-conditions";

const t = ((key: string) => key) as unknown as TFunction;

describe("filter-conditions", () => {
  describe("toConditionGroup", () => {
    test("maps the tree onto the editor's shape, with the top-level logic as the root connector", () => {
      const filters: FilterNode[] = [
        { id: "a", field: "FeedbackRecords.fieldType", operator: "equals", values: ["ces"] },
        {
          id: "g1",
          logic: "or",
          children: [
            { id: "b", field: "FeedbackRecords.sourceName", operator: "equals", values: ["PAF_Pre"] },
            { id: "c", field: "FeedbackRecords.sourceType", operator: "set", values: null },
          ],
        },
      ];

      expect(toConditionGroup(filters, "and")).toEqual({
        id: CHART_FILTER_ROOT_ID,
        connector: "and",
        conditions: [
          {
            id: "a",
            leftOperand: { value: "FeedbackRecords.fieldType", type: "field" },
            operator: "equals",
            rightOperand: { value: "ces", type: "static" },
          },
          {
            id: "g1",
            connector: "or",
            conditions: [
              {
                id: "b",
                leftOperand: { value: "FeedbackRecords.sourceName", type: "field" },
                operator: "equals",
                rightOperand: { value: "PAF_Pre", type: "static" },
              },
              {
                id: "c",
                leftOperand: { value: "FeedbackRecords.sourceType", type: "field" },
                operator: "set",
                rightOperand: undefined,
              },
            ],
          },
        ],
      });
    });
  });

  describe("toFilterRowUpdates", () => {
    test("a field change resets the operator to that field's default and clears the value", () => {
      expect(
        toFilterRowUpdates({
          leftOperand: { value: EMOTIONS_DIMENSION_ID, type: "field" },
          operator: "equals",
          rightOperand: undefined,
        })
      ).toEqual({ field: EMOTIONS_DIMENSION_ID, operator: "contains", values: null });
    });

    test("an operator change clears the value", () => {
      expect(toFilterRowUpdates({ operator: "notEquals", rightOperand: undefined })).toEqual({
        operator: "notEquals",
        values: null,
      });
    });

    test("a value change keeps numbers numeric and treats an empty value as unset", () => {
      expect(toFilterRowUpdates({ rightOperand: { value: 50, type: "static" } })).toEqual({ values: [50] });
      expect(toFilterRowUpdates({ rightOperand: { value: "joy", type: "static" } })).toEqual({
        values: ["joy"],
      });
      expect(toFilterRowUpdates({ rightOperand: { value: "", type: "static" } })).toEqual({ values: null });
      expect(toFilterRowUpdates({ rightOperand: undefined })).toEqual({ values: null });
    });
  });

  describe("field helpers", () => {
    test("offers dimensions and only score/average measures", () => {
      const [dimensions, measures] = getFilterFieldOptions(t);
      expect(dimensions.options.map((o) => o.value)).toContain("FeedbackRecords.fieldType");
      expect(measures.options.map((o) => o.value)).not.toContain("FeedbackRecords.count");
      expect(measures.options.length).toBeGreaterThan(0);
    });

    test("falls back to a text field for an unknown id", () => {
      expect(getFilterFieldType("FeedbackRecords.doesNotExist")).toBe("string");
      expect(getDefaultFilterOperator("FeedbackRecords.doesNotExist")).toBe("equals");
    });
  });
});
