import { describe, expect, test } from "vitest";
import {
  buildToolbarProperties,
  fromToolbarFilters,
  getToolbarRuleOperators,
  toToolbarFilters,
} from "./dashboard-toolbar-filters";

const SOURCE = "FeedbackRecords.sourceName";
const SENTIMENT = "FeedbackRecords.sentiment";
const SCORE = "FeedbackRecords.valueNumber";
const COLLECTED_AT = "FeedbackRecords.collectedAt";
const TEXT = "FeedbackRecords.valueText";

describe("toToolbarFilters", () => {
  test("equals on a field with a fixed set of values is the toolbar's quick filter with every value", () => {
    expect(
      toToolbarFilters([{ field: SENTIMENT, operator: "equals", values: ["positive", "mixed"] }])
    ).toEqual([{ property: SENTIMENT, operator: "in", values: ["positive", "mixed"] }]);
  });

  test("a list field's equals and not equals are is any of / is none of, with every value", () => {
    expect(
      toToolbarFilters([
        { field: SOURCE, operator: "equals", values: ["Web", "App"] },
        { field: SOURCE, operator: "notEquals", values: ["Web", "App"] },
        { field: SENTIMENT, operator: "notEquals", values: ["negative", "very_negative"] },
      ])
    ).toEqual([
      { property: SOURCE, operator: "isAnyOf", values: ["Web", "App"] },
      { property: SOURCE, operator: "isNoneOf", values: ["Web", "App"] },
      { property: SENTIMENT, operator: "isNoneOf", values: ["negative", "very_negative"] },
    ]);
  });

  test("any other filter is a rule on its one value, the operator named as the toolbar does", () => {
    expect(
      toToolbarFilters([
        { field: SCORE, operator: "gt", values: ["7"] },
        { field: TEXT, operator: "notContains", values: ["late"] },
        { field: SOURCE, operator: "contains", values: ["We", "Ap"] },
      ])
    ).toEqual([
      { property: SCORE, operator: "greaterThan", values: ["7"] },
      { property: TEXT, operator: "doesNotContain", values: ["late"] },
      { property: SOURCE, operator: "contains", values: ["We"] },
    ]);
  });

  test("a filter with no values is left out", () => {
    expect(toToolbarFilters([{ field: SCORE, operator: "gt", values: [] }])).toEqual([]);
  });

  test("a time field is compared with after and before, and has no name for the rest", () => {
    expect(
      toToolbarFilters([
        { field: COLLECTED_AT, operator: "gt", values: ["2026-01-01"] },
        { field: COLLECTED_AT, operator: "lt", values: ["2026-02-01"] },
        { field: COLLECTED_AT, operator: "gte", values: ["2026-03-01"] },
      ])
    ).toEqual([
      { property: COLLECTED_AT, operator: "isAfter", values: ["2026-01-01"] },
      { property: COLLECTED_AT, operator: "isBefore", values: ["2026-02-01"] },
    ]);
  });
});

describe("fromToolbarFilters", () => {
  test("is the inverse of the above", () => {
    const filters = [
      { field: SENTIMENT, operator: "equals" as const, values: ["positive", "mixed"] },
      { field: SOURCE, operator: "equals" as const, values: ["Web", "App"] },
      { field: SOURCE, operator: "notEquals" as const, values: ["Email"] },
      { field: SENTIMENT, operator: "notEquals" as const, values: ["negative", "mixed"] },
      { field: SCORE, operator: "gte" as const, values: ["7"] },
      { field: TEXT, operator: "notContains" as const, values: ["late"] },
      { field: COLLECTED_AT, operator: "lt" as const, values: ["2026-02-01"] },
    ];
    expect(fromToolbarFilters(toToolbarFilters(filters))).toEqual(filters);
  });

  test("leaves out a filter that is not a comparison with a value", () => {
    expect(
      fromToolbarFilters([
        { property: SOURCE, operator: "isSet", values: [] },
        { property: SOURCE, operator: "in", values: [] },
        { property: SOURCE, operator: "startsWith", values: ["x"] },
        { property: SOURCE, operator: "isAnyOf", values: [] },
      ])
    ).toEqual([]);
  });

  test("an is-any-of rule on a quick field becomes its quick filter, keeping every value", () => {
    const rule = { property: SENTIMENT, operator: "isAnyOf" as const, values: ["positive", "mixed"] };
    expect(toToolbarFilters(fromToolbarFilters([rule]))).toEqual([
      { property: SENTIMENT, operator: "in", values: ["positive", "mixed"] },
    ]);
  });
});

describe("getToolbarRuleOperators", () => {
  test("offers a field the operators it allows, in the toolbar's names", () => {
    expect(getToolbarRuleOperators(SCORE)).toEqual([
      "equals",
      "notEquals",
      "greaterThan",
      "greaterEqual",
      "lessThan",
      "lessEqual",
    ]);
    expect(getToolbarRuleOperators(COLLECTED_AT)).toEqual(["isAfter", "isBefore"]);
    expect(getToolbarRuleOperators(TEXT)).toEqual(["equals", "notEquals", "contains", "doesNotContain"]);
    expect(getToolbarRuleOperators("FeedbackRecords.notAField")).toEqual([]);
  });

  test("a list field picks several values, and partial text only where its values are not a fixed set", () => {
    expect(getToolbarRuleOperators(SOURCE)).toEqual(["isAnyOf", "isNoneOf", "contains", "doesNotContain"]);
    expect(getToolbarRuleOperators(SENTIMENT)).toEqual(["isAnyOf", "isNoneOf"]);
    expect(getToolbarRuleOperators("FeedbackRecords.valueBand")).toEqual(["isAnyOf", "isNoneOf"]);
    expect(getToolbarRuleOperators("FeedbackRecords.ed_region")).toEqual([
      "isAnyOf",
      "isNoneOf",
      "contains",
      "doesNotContain",
    ]);
  });
});

describe("buildToolbarProperties", () => {
  const t = ((key: string) => key) as never;
  const properties = buildToolbarProperties({
    t,
    embeddedFields: [{ name: "FeedbackRecords.ed_region", key: "Region" }],
    dashboardId: "d1",
    filters: [],
    dateRange: null,
  });
  const byId = (id: string) => properties.find((property) => property.id === id);

  test("only fields with a fixed set of values are quick filters, each with its values", () => {
    expect(
      properties
        .filter((property) => property.quick)
        .map(({ id }) => id)
        .sort()
    ).toEqual(["FeedbackRecords.sentiment", "FeedbackRecords.valueBand"]);
    expect(byId(SENTIMENT)?.options?.map(({ value }) => value)).toEqual([
      "very_negative",
      "negative",
      "neutral",
      "positive",
      "very_positive",
      "mixed",
    ]);
  });

  test("a categorical field and an embedded-data key are Advanced filter only, and list their values there", () => {
    for (const id of [SOURCE, "FeedbackRecords.metadataDevice", "FeedbackRecords.ed_region"]) {
      expect(byId(id)).toMatchObject({ valueType: "enum" });
      expect(byId(id)?.quick).toBeUndefined();
      expect(byId(id)?.options).toBeUndefined();
      expect(byId(id)?.loadOptions).toBeTypeOf("function");
      expect(byId(id)?.ruleOperators?.length).toBeGreaterThan(0);
    }
  });

  test("leaves out a record's question type and question id, which only a chart groups by", () => {
    expect(byId("FeedbackRecords.fieldType")).toBeUndefined();
    expect(byId("FeedbackRecords.fieldId")).toBeUndefined();
  });

  test("a boolean is picked from yes and no, one value at a time", () => {
    const booleanField = properties.find((property) => property.options?.[0]?.label === "common.yes");
    expect(booleanField?.ruleOperators).toEqual(["equals", "notEquals"]);
  });

  test("free text is typed, not listed", () => {
    expect(byId(TEXT)).toMatchObject({ valueType: "string" });
    expect(byId(TEXT)?.loadOptions).toBeUndefined();
  });

  test("a number is typed as one, a time as a date, and no measure is offered", () => {
    expect(byId(SCORE)).toMatchObject({ valueType: "number" });
    expect(byId(COLLECTED_AT)).toMatchObject({ valueType: "date" });
    expect(byId("FeedbackRecords.count")).toBeUndefined();
  });
});
