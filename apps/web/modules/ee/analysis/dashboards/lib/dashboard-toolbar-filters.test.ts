import { describe, expect, test, vi } from "vitest";
import { listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { NO_VALUE_PICK } from "./dashboard-filters";
import {
  buildToolbarProperties,
  disambiguateEmbeddedLabels,
  fromToolbarFilters,
  getToolbarRuleOperators,
  toToolbarFilters,
} from "./dashboard-toolbar-filters";

vi.mock("@/modules/ee/analysis/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/lib/api-client")>()),
  listDashboardFilterValues: vi.fn(),
}));

const SOURCE = "FeedbackRecords.sourceName";
const EMOTIONS = "FeedbackRecords.emotions";
const EMOTION_LABELS = ["joy", "anger", "sadness", "fear", "surprise", "disgust"];
const SENTIMENT = "FeedbackRecords.sentiment";
const SCORE = "FeedbackRecords.valueNumber";
const COLLECTED_AT = "FeedbackRecords.collectedAt";
const TEXT = "FeedbackRecords.valueText";
const BOOLEAN = "FeedbackRecords.valueBoolean";

describe("toToolbarFilters", () => {
  test("equals on a field with a fixed set of values is the toolbar's quick filter with every value", () => {
    expect(
      toToolbarFilters([{ field: SENTIMENT, operator: "equals", values: ["positive", "mixed"] }])
    ).toEqual([{ property: SENTIMENT, operator: "in", values: ["positive", "mixed"] }]);
  });

  test("a list field's equals and not equals keep every value", () => {
    expect(
      toToolbarFilters([
        { field: SOURCE, operator: "equals", values: ["Web", "App"] },
        { field: SOURCE, operator: "notEquals", values: ["Web", "App"] },
        { field: SENTIMENT, operator: "notEquals", values: ["negative", "very_negative"] },
      ])
    ).toEqual([
      { property: SOURCE, operator: "equals", values: ["Web", "App"] },
      { property: SOURCE, operator: "notEquals", values: ["Web", "App"] },
      { property: SENTIMENT, operator: "notEquals", values: ["negative", "very_negative"] },
    ]);
  });

  test("is set and is not set hold no value", () => {
    expect(
      toToolbarFilters([
        { field: SOURCE, operator: "set", values: [] },
        { field: COLLECTED_AT, operator: "notSet", values: [] },
      ])
    ).toEqual([
      { property: SOURCE, operator: "isSet", values: [] },
      { property: COLLECTED_AT, operator: "isNotSet", values: [] },
    ]);
  });

  test("emotions contains any of / none of keep every label, both ways", () => {
    const stated = [
      { field: EMOTIONS, operator: "contains" as const, values: ["joy", "fear"] },
      { field: EMOTIONS, operator: "notContains" as const, values: ["anger", "disgust"] },
    ];
    const toolbar = [
      { property: EMOTIONS, operator: "contains", values: ["joy", "fear"] },
      { property: EMOTIONS, operator: "doesNotContain", values: ["anger", "disgust"] },
    ];
    expect(toToolbarFilters(stated)).toEqual(toolbar);
    expect(fromToolbarFilters(toolbar as never)).toEqual(stated);
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
      { field: SOURCE, operator: "set" as const, values: [] },
      { field: SENTIMENT, operator: "notSet" as const, values: [] },
      { field: SOURCE, operator: "equals" as const, values: ["Web", NO_VALUE_PICK] },
    ];
    expect(fromToolbarFilters(toToolbarFilters(filters))).toEqual(filters);
  });

  test("leaves out a filter with nothing to compare against, or an operator it has no name for", () => {
    expect(
      fromToolbarFilters([
        { property: SOURCE, operator: "in", values: [] },
        { property: SOURCE, operator: "startsWith", values: ["x"] },
        { property: SOURCE, operator: "equals", values: [] },
      ])
    ).toEqual([]);
  });

  test("a free-text field's is keeps its one value", () => {
    expect(fromToolbarFilters([{ property: TEXT, operator: "equals", values: ["a", "b"] }])).toEqual([
      { field: TEXT, operator: "equals", values: ["a"] },
    ]);
  });

  test("an is rule on a quick field becomes its quick filter, keeping every value", () => {
    const rule = { property: SENTIMENT, operator: "equals" as const, values: ["positive", "mixed"] };
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
      "isSet",
      "isNotSet",
    ]);
    expect(getToolbarRuleOperators(COLLECTED_AT)).toEqual(["isBefore", "isAfter", "isSet", "isNotSet"]);
    expect(getToolbarRuleOperators(TEXT)).toEqual([
      "contains",
      "doesNotContain",
      "equals",
      "notEquals",
      "isSet",
      "isNotSet",
    ]);
    expect(getToolbarRuleOperators(BOOLEAN)).toEqual(["equals", "isSet", "isNotSet"]);
    expect(getToolbarRuleOperators("FeedbackRecords.notAField")).toEqual([]);
  });

  test("a looked-up field offers partial text too; a fixed set only is and is not", () => {
    const looked = ["equals", "notEquals", "contains", "doesNotContain", "isSet", "isNotSet"];
    expect(getToolbarRuleOperators(SOURCE)).toEqual(looked);
    expect(getToolbarRuleOperators("FeedbackRecords.ed_region")).toEqual(looked);
    expect(getToolbarRuleOperators(SENTIMENT)).toEqual(["equals", "notEquals", "isSet", "isNotSet"]);
    expect(getToolbarRuleOperators("FeedbackRecords.valueBand")).toEqual([
      "equals",
      "notEquals",
      "isSet",
      "isNotSet",
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
      NO_VALUE_PICK,
      "very_negative",
      "negative",
      "neutral",
      "positive",
      "very_positive",
      "mixed",
    ]);
  });

  test("a fixed set says which of its values occur, with a hint for when none do", () => {
    expect(byId(SENTIMENT)?.availableValues?.emptyHint).toBe(
      "workspace.analysis.dashboards.filter_no_sentiment_yet"
    );
    expect(byId("FeedbackRecords.valueBand")?.availableValues?.emptyHint).toBe(
      "workspace.analysis.dashboards.filter_no_values_yet"
    );
    expect(byId(BOOLEAN)?.availableValues).toBeDefined();
    expect(byId(SOURCE)?.availableValues).toBeUndefined();
  });

  test("sentiment score and emotions follow sentiment, with its hint", () => {
    const sentiment = byId(SENTIMENT)?.availableValues;
    expect(byId("FeedbackRecords.sentimentScore")?.availableValues?.queryKey).toEqual(sentiment?.queryKey);
    for (const id of ["FeedbackRecords.sentimentScore", EMOTIONS]) {
      expect(byId(id)?.availableValues?.emptyHint).toBe(
        "workspace.analysis.dashboards.filter_no_sentiment_yet"
      );
    }
  });

  test("emotions picks several of its labels with contains any of / none of, and no (No value)", () => {
    expect(byId(EMOTIONS)).toMatchObject({
      valueType: "enum",
      multiValueContains: true,
      ruleOperators: ["contains", "doesNotContain", "isSet", "isNotSet"],
    });
    expect(byId(EMOTIONS)?.quick).toBeUndefined();
    expect(byId(EMOTIONS)?.multiValueEquals).toBeUndefined();
    expect(byId(EMOTIONS)?.options?.map(({ value }) => value)).toEqual(EMOTION_LABELS);
  });

  test("emotions is disabled while nothing has a sentiment, and otherwise greys none of its labels", async () => {
    const available = byId(EMOTIONS)?.availableValues;
    // Cached apart from Sentiment's lookup, which holds sentiment values rather than labels.
    expect(available?.queryKey).not.toEqual(byId(SENTIMENT)?.availableValues?.queryKey);
    vi.mocked(listDashboardFilterValues).mockResolvedValueOnce({
      values: [{ value: "positive" }],
      hasMore: false,
    } as never);
    expect(await available?.load()).toEqual({ values: EMOTION_LABELS });
    vi.mocked(listDashboardFilterValues).mockResolvedValueOnce({ values: [], hasMore: false } as never);
    expect(await available?.load()).toEqual({ values: [] });
  });

  test("a categorical field and an embedded-data key list their values, after (No value)", () => {
    for (const id of [SOURCE, "FeedbackRecords.metadataDevice", "FeedbackRecords.ed_region"]) {
      expect(byId(id)).toMatchObject({ valueType: "enum", multiValueEquals: true });
      expect(byId(id)?.quick).toBeUndefined();
      expect(byId(id)?.options).toEqual([
        { value: NO_VALUE_PICK, label: "workspace.analysis.dashboards.filter_no_value" },
      ]);
      expect(byId(id)?.loadOptions).toBeTypeOf("function");
      expect(byId(id)?.ruleOperators?.length).toBeGreaterThan(0);
    }
  });

  test("leaves out a record's question type and question id, which only a chart groups by", () => {
    expect(byId("FeedbackRecords.fieldType")).toBeUndefined();
    expect(byId("FeedbackRecords.fieldId")).toBeUndefined();
  });

  test("a boolean is picked from yes and no (or no value), and is only is", () => {
    expect(byId(BOOLEAN)?.options?.map(({ value }) => value)).toEqual([NO_VALUE_PICK, "true", "false"]);
    expect(byId(BOOLEAN)?.ruleOperators).toEqual(["equals", "isSet", "isNotSet"]);
    expect(byId(BOOLEAN)?.multiValueEquals).toBe(true);
    expect(byId(BOOLEAN)?.quick).toBe(false);
  });

  test("a field's list is not narrowed by its own list filters or set / not set", () => {
    const narrowed = buildToolbarProperties({
      t,
      embeddedFields: [],
      dashboardId: "d1",
      filters: [
        { field: SENTIMENT, operator: "notSet", values: [] },
        { field: SENTIMENT, operator: "equals", values: ["positive"] },
        { field: SOURCE, operator: "set", values: [] },
      ],
      dateRange: null,
    }).find((property) => property.id === SENTIMENT);
    expect(narrowed?.availableValues?.queryKey).toContainEqual(
      expect.objectContaining({ filters: [{ field: SOURCE, operator: "set", values: [] }] })
    );
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
  test("an answer's option is a list field whose values are looked up by their labels", async () => {
    const option = byId("FeedbackRecords.valueId");
    expect(option).toMatchObject({ valueType: "enum", multiValueEquals: true, labelledValues: true });
    expect(option?.ruleOperators).toContain("equals");
    vi.mocked(listDashboardFilterValues).mockResolvedValueOnce({
      values: [{ value: "late", label: "Late" }, { value: "raw" }],
      hasMore: false,
    } as never);
    expect((await option?.loadOptions?.(""))?.options).toEqual([
      { value: NO_VALUE_PICK, label: "workspace.analysis.dashboards.filter_no_value" },
      { value: "late", label: "Late" },
      { value: "raw", label: "raw" },
    ]);
    expect(byId(SOURCE)?.labelledValues).toBe(false);
  });

  test("Language's (No value) reads Default; every other field's (No value)", () => {
    expect(byId("FeedbackRecords.language")?.options).toEqual([
      { value: NO_VALUE_PICK, label: "workspace.analysis.dashboards.filter_no_value_language" },
    ]);
    expect(byId(SOURCE)?.options?.[0]?.label).toBe("workspace.analysis.dashboards.filter_no_value");
  });

  test("the sentiment score's typed value hints at its range; other numbers keep the default", () => {
    expect(byId("FeedbackRecords.sentimentScore")?.placeholder).toBe(
      "workspace.analysis.dashboards.filter_sentiment_score_placeholder"
    );
    expect(byId(SCORE)?.placeholder).toBeUndefined();
  });

  test("an embedded-data key named like a dimension says it is embedded data; others keep their name", () => {
    const interpolate = ((key: string, options?: { field?: string }) => {
      if (options?.field) return `${options.field} (${key})`;
      return key === "workspace.analysis.charts.field_label_language" ? "Language" : key;
    }) as never;
    const named = buildToolbarProperties({
      t: interpolate,
      embeddedFields: [
        { name: "FeedbackRecords.ed_language", key: "language" },
        { name: "FeedbackRecords.ed_plan", key: "Plan" },
      ],
      dashboardId: "d1",
      filters: [],
      dateRange: null,
    });
    const labelOf = (id: string) => named.find((property) => property.id === id)?.label;
    expect(labelOf("FeedbackRecords.ed_language")).toBe(
      "language (workspace.analysis.dashboards.filter_embedded_field_label)"
    );
    expect(labelOf("FeedbackRecords.ed_plan")).toBe("Plan");
    expect(labelOf("FeedbackRecords.language")).toBe("Language");
  });
});

describe("disambiguateEmbeddedLabels", () => {
  test("relabels only the embedded properties whose label another property shares", () => {
    const properties = [
      { id: "dim", label: "Channel", valueType: "string" as const },
      { id: "ed_channel", label: "Channel", valueType: "string" as const },
      { id: "ed_plan", label: "Plan", valueType: "string" as const },
    ];
    const relabelled = disambiguateEmbeddedLabels(
      properties,
      (property) => property.id.startsWith("ed_"),
      (label) => `${label} · Embedded data`
    );
    expect(relabelled.map(({ label }) => label)).toEqual(["Channel", "Channel · Embedded data", "Plan"]);
  });
});
