import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { FilterNode } from "@/modules/ee/analysis/lib/query-builder";
import { EMOTIONS_DIMENSION_ID } from "@/modules/ee/analysis/lib/schema-definition";
import {
  CHART_FILTER_ROOT_ID,
  getAnswerOperatorOptions,
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

describe("dataset fields in the filter editor (ENG-6893, ENG-6637)", () => {
  const dataset = {
    embeddedFields: [{ name: "FeedbackRecords.ed_plan_64879f7d", key: "plan" }],
    answerQuestions: [
      { id: "q_delivery", label: "Delivery", kind: "choice" as const, options: [] },
      { id: "q_feat", label: "Features", kind: "multi" as const, options: [] },
    ],
  };

  test("adds no group for a dataset without embedded data or questions", () => {
    expect(getFilterFieldOptions(t, { embeddedFields: [], answerQuestions: [] })).toEqual(
      getFilterFieldOptions(t)
    );
  });

  test("offers embedded keys under their own names and each question as 'Answer to question'", () => {
    const groups = getFilterFieldOptions(t, dataset);

    expect(groups.at(-2)).toEqual({
      label: "workspace.analysis.charts.embedded_data",
      value: "embeddedData",
      options: [{ value: "FeedbackRecords.ed_plan_64879f7d", label: "plan" }],
    });
    expect(groups.at(-1)).toEqual({
      label: "workspace.analysis.charts.answer_to_question",
      value: "answerToQuestion",
      options: [
        { value: "FeedbackRecords.answer:q_delivery", label: "Delivery" },
        { value: "FeedbackRecords.answer:q_feat", label: "Features" },
      ],
    });
    expect(getDefaultFilterOperator("FeedbackRecords.answer:q_feat")).toBe("equals");
  });

  test("offers is, is not and is any of for a single-select, and contains and is any of for a multi-select", () => {
    expect(getAnswerOperatorOptions(dataset.answerQuestions[0], t)).toEqual([
      { value: "equals", label: "workspace.analysis.charts.is" },
      { value: "notEquals", label: "workspace.analysis.charts.is_not" },
      { value: "isAnyOf", label: "workspace.analysis.charts.is_any_of" },
    ]);
    expect(getAnswerOperatorOptions(dataset.answerQuestions[1], t)).toEqual([
      { value: "equals", label: "workspace.analysis.charts.contains" },
      { value: "isAnyOf", label: "workspace.analysis.charts.is_any_of" },
    ]);
  });

  test("hands the editor every picked value of an 'is any of' rule", () => {
    const group = toConditionGroup(
      [{ id: "a", field: "FeedbackRecords.answer:q_feat", operator: "isAnyOf", values: ["x", "y"] }],
      "and"
    );
    expect(group.conditions[0]).toMatchObject({ rightOperand: { value: ["x", "y"], type: "static" } });
  });
});
