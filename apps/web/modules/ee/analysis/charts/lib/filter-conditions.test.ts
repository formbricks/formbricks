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

  describe("Embedded Data fields (ENG-2848)", () => {
    const brand = {
      id: "FeedbackRecords.ed_0123456789abcdef",
      name: "brand",
      type: "string" as const,
      surveyNames: ["A"],
    };
    const seats = {
      id: "FeedbackRecords.ed_1111111111111111",
      name: "seats",
      type: "number" as const,
      surveyNames: ["A"],
    };
    const trial = {
      id: "FeedbackRecords.ed_2222222222222222",
      name: "trial",
      type: "boolean" as const,
      surveyNames: ["A"],
    };
    const fields = [brand, seats, trial];

    test("offers them as a last group, labelled by name", () => {
      const groups = getFilterFieldOptions(t, fields);
      expect(groups.at(-1)).toEqual({
        label: "common.embedded_data",
        value: "embeddedData",
        options: [
          { value: brand.id, label: "brand" },
          { value: seats.id, label: "seats" },
          { value: trial.id, label: "trial" },
        ],
      });
      expect(getFilterFieldOptions(t).some((group) => group.value === "embeddedData")).toBe(false);
    });

    test("types them from the dataset, so each gets its own operators", () => {
      expect(getFilterFieldType(brand.id, fields)).toBe("string");
      expect(getFilterFieldType(seats.id, fields)).toBe("number");
      expect(getFilterFieldType(trial.id, fields)).toBe("boolean");
      expect(getDefaultFilterOperator(seats.id, fields)).toBe("equals");
    });

    test("resets the operator for the picked field's type", () => {
      expect(toFilterRowUpdates({ leftOperand: { value: trial.id, type: "field" } }, fields)).toEqual({
        field: trial.id,
        operator: "equals",
        values: null,
      });
    });
  });
});
