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
  getLegacyBooleanFilterValueOption,
  getQuestionValueOptions,
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

  describe("boolean filter choices", () => {
    test.each([undefined, "", "true", "false"])("adds no extra choice for %s", (value) => {
      expect(getLegacyBooleanFilterValueOption(value)).toBeUndefined();
    });

    test("displays a saved free-text value without offering it as a choice", () => {
      expect(getLegacyBooleanFilterValueOption("TRUE")).toEqual({
        value: "TRUE",
        label: "TRUE",
        disabled: true,
      });
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

  test("offers the builder's own equals, not equals and is any of for a single-select, and contains and is any of for a multi-select (U7)", () => {
    expect(getAnswerOperatorOptions(dataset.answerQuestions[0], t)).toEqual([
      { value: "equals", label: "workspace.analysis.charts.equals" },
      { value: "notEquals", label: "workspace.analysis.charts.not_equals" },
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

describe("question filters in the filter editor (ENG-7323)", () => {
  const scale = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => ({ value: String(from + index), label: "" }));
  const questions = [
    { id: "q_nps", label: "Recommend us?" },
    { id: "q_text", label: "Anything else?" },
  ];

  test("leads the dimensions with the question id as 'Question' when the dataset has questions", () => {
    const [dimensions] = getFilterFieldOptions(t, { embeddedFields: [], answerQuestions: [], questions });
    expect(dimensions.options?.[0]).toEqual({
      value: "FeedbackRecords.fieldId",
      label: "workspace.analysis.charts.question_filter_field",
    });
    expect(dimensions.options?.filter((option) => option.value === "FeedbackRecords.fieldId")).toHaveLength(
      1
    );
  });

  test("keeps the question id as a plain field without questions to pick from", () => {
    const [dimensions] = getFilterFieldOptions(t, { embeddedFields: [], answerQuestions: [] });
    expect(dimensions.options?.[0]?.value).not.toBe("FeedbackRecords.fieldId");
    expect(dimensions.options).toContainEqual(
      expect.objectContaining({
        value: "FeedbackRecords.fieldId",
        label: "workspace.analysis.charts.field_label_field_id",
      })
    );
  });

  test("offers each question by label, keyed by id, and keeps a stored id the list no longer has", () => {
    expect(getQuestionValueOptions(questions, "q_text")).toEqual([
      { value: "q_nps", label: "Recommend us?" },
      { value: "q_text", label: "Anything else?" },
    ]);
    expect(getQuestionValueOptions(questions, "q_gone")).toContainEqual({ value: "q_gone", label: "q_gone" });
  });

  test("offers 'NPS segment is' on an NPS question only", () => {
    const nps = { id: "q_nps", label: "NPS", kind: "number" as const, options: scale(0, 10) };
    const rating = { id: "q_rating", label: "Rating", kind: "number" as const, options: scale(1, 10) };
    expect(getAnswerOperatorOptions(nps, t)).toContainEqual({
      value: "npsSegment",
      label: "workspace.analysis.charts.nps_segment_is",
    });
    expect(getAnswerOperatorOptions(rating, t).map((option) => option.value)).not.toContain("npsSegment");
  });
});
