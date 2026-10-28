import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { OptionsType } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { generateElementAndFilterOptions, getFormattedFilters } from "@/app/lib/surveys/surveys";
import type { TTableFilter } from "@/modules/ui/components/table-toolbar/lib/types";
import {
  applicableResponseFilters,
  buildResponseFilterModel,
  filterValueToTableFilter,
  isQuestionFilter,
  normalizeSummaryFilterRow,
  toResponseFilterState,
} from "./response-table-filters";

const t = ((key: string) => key) as unknown as TFunction;

const element = (overrides: Record<string, unknown>) => ({
  headline: { default: String(overrides.id) },
  required: false,
  ...overrides,
});

const survey = {
  id: "survey1",
  type: "link",
  languages: [
    { language: { code: "en" }, default: true, enabled: true },
    { language: { code: "de" }, default: false, enabled: true },
  ],
  blocks: [
    {
      id: "block1",
      name: "Block 1",
      elements: [
        element({ id: "feedback", type: TSurveyElementTypeEnum.OpenText, inputType: "text" }),
        element({
          id: "plan",
          type: TSurveyElementTypeEnum.MultipleChoiceMulti,
          choices: [
            { id: "c1", label: { default: "Free" } },
            { id: "c2", label: { default: "Pro" } },
          ],
        }),
        element({ id: "nps", type: TSurveyElementTypeEnum.NPS, lowerLabel: {}, upperLabel: {} }),
        element({
          id: "grid",
          type: TSurveyElementTypeEnum.Matrix,
          rows: [
            { id: "r1", label: { default: "Speed" } },
            { id: "r2", label: { default: "Price" } },
          ],
          columns: [
            { id: "k1", label: { default: "Good" } },
            { id: "k2", label: { default: "Bad" } },
          ],
        }),
      ],
    },
  ],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
  embeddedDataFields: [],
} as unknown as TSurvey;

const options = generateElementAndFilterOptions({
  survey,
  environmentTags: [{ id: "tag1", name: "vip" } as never],
  attributes: { plan: ["Pro", "Free"] },
  reservedValues: {},
  hiddenFields: {},
  variableValues: {},
  quotas: [{ id: "quota1", name: "Germany" } as never],
  t,
});

const model = buildResponseFilterModel({
  survey,
  elementOptions: options.elementOptions,
  elementFilterOptions: options.elementFilterOptions,
  tagNames: ["vip", "churn risk"],
  t,
});

const property = (id: string) => model.properties.find((item) => item.id === id);
const criteriaFor = (filters: TTableFilter[], now = new Date("2026-10-27T12:00:00.000Z")) => {
  const { selectedFilter, dateRange } = toResponseFilterState(filters, model.fields, "UTC", now);
  return getFormattedFilters(survey, selectedFilter, dateRange);
};

describe("buildResponseFilterModel", () => {
  test("offers Status, Date, Tags and Language as quick filters and nothing else", () => {
    const quick = model.properties.filter((item) => item.quick).map((item) => item.id);
    expect(quick).toEqual(["status", "createdAt", "tag", "language"]);
  });

  test("gives each question the rule operators its type supports", () => {
    expect(property("question.feedback")?.ruleOperators).toEqual(["isSet", "isNotSet"]);
    expect(property("question.plan")?.ruleOperators).toEqual(["includesAllOf", "includesOneOf"]);
    expect(property("question.plan")?.options?.map((option) => option.value)).toEqual(["Free", "Pro"]);
    expect(property("question.nps")?.ruleOperators).toEqual(
      expect.arrayContaining(["equals", "lessThan", "greaterThan", "isSet", "isNotSet", "includesOneOf"])
    );
  });

  test("splits a matrix into one property per row, keyed by row id", () => {
    expect(property("question.grid.r1")).toMatchObject({ ruleOperators: ["equals"], valueType: "enum" });
    expect(property("question.grid.r2")?.options?.map((option) => option.value)).toEqual(["Good", "Bad"]);
  });

  test("adds attributes and quotas, which only the filter data knows about", () => {
    expect(property("attribute.plan")?.ruleOperators).toEqual(["equals", "notEquals"]);
    expect(property("quota.quota1")?.ruleOperators).toEqual(["equals"]);
  });
});

describe("toResponseFilterState → getFormattedFilters", () => {
  test("no filters means no criteria", () => {
    expect(criteriaFor([])).toEqual({});
  });

  test("one ticked status narrows by finished; both mean all responses", () => {
    expect(criteriaFor([{ property: "status", operator: "in", values: ["complete"] }])).toEqual({
      finished: true,
    });
    expect(criteriaFor([{ property: "status", operator: "in", values: ["partial"] }])).toEqual({
      finished: false,
    });
    expect(criteriaFor([{ property: "status", operator: "in", values: ["complete", "partial"] }])).toEqual(
      {}
    );
  });

  test("a date preset resolves to whole days in the reporting time zone at request time", () => {
    const now = new Date("2026-10-27T12:00:00.000Z");
    const filters: TTableFilter[] = [{ property: "createdAt", operator: "preset", values: ["last_7_days"] }];
    const bounds = (timeZone: string) => {
      const { selectedFilter, dateRange } = toResponseFilterState(filters, model.fields, timeZone, now);
      const { min, max } = getFormattedFilters(survey, selectedFilter, dateRange).createdAt ?? {};
      return { min: min?.toISOString(), max: max?.toISOString() };
    };
    // Noon UTC on Oct 27 is already Oct 28 in Auckland (UTC+13), so its seven days end a day later and
    // each starts at that zone's local midnight.
    expect(bounds("UTC")).toEqual({ min: "2026-10-21T00:00:00.000Z", max: "2026-10-27T23:59:59.999Z" });
    expect(bounds("Pacific/Auckland")).toEqual({
      min: "2026-10-21T11:00:00.000Z",
      max: "2026-10-28T10:59:59.999Z",
    });
  });

  test("ticked tags mean any of them; is / is not rules name one tag each", () => {
    expect(
      criteriaFor([
        { property: "tag", operator: "in", values: ["vip", "churn risk"] },
        { property: "tag", operator: "equals", values: ["beta"] },
        { property: "tag", operator: "notEquals", values: ["spam"] },
      ]).tags
    ).toEqual({ applied: ["beta"], notApplied: ["spam"], appliedAny: ["vip", "churn risk"] });
  });

  test("ticked languages become one any-of condition", () => {
    expect(criteriaFor([{ property: "language", operator: "in", values: ["en", "de"] }]).others).toEqual({
      Language: { op: "in", value: ["en", "de"] },
    });
  });

  test("question rules map onto the operators each question type understands", () => {
    expect(
      criteriaFor([
        { property: "question.feedback", operator: "isNotSet", values: [] },
        { property: "question.plan", operator: "includesAllOf", values: ["Free", "Pro"] },
        { property: "question.nps", operator: "greaterThan", values: ["8"] },
        { property: "question.grid.r2", operator: "equals", values: ["Bad"] },
      ]).data
    ).toEqual({
      feedback: { op: "skipped" },
      plan: { op: "includesAll", value: ["Free", "Pro"] },
      nps: { op: "greaterThan", value: 8 },
      grid: { op: "matrix", value: { Price: "Bad" } },
    });
  });

  test("attribute and quota rules reach their criteria groups", () => {
    const criteria = criteriaFor([
      { property: "attribute.plan", operator: "notEquals", values: ["Free"] },
      { property: "quota.quota1", operator: "equals", values: ["Screened in"] },
    ]);
    expect(criteria.contactAttributes).toEqual({ plan: { op: "notEquals", value: "Free" } });
    expect(criteria.quotas).toEqual({ quota1: { op: "screenedIn" } });
  });

  test("a rule on a property the survey no longer has is dropped, not sent", () => {
    expect(criteriaFor([{ property: "question.deleted", operator: "isSet", values: [] }])).toEqual({});
  });
});

describe("filterValueToTableFilter", () => {
  const row = (
    elementType: TSurveyElementTypeEnum,
    id: string,
    filterValue: string,
    combo?: string | string[]
  ) => ({
    elementType: { type: OptionsType.ELEMENTS, id, label: id, elementType },
    filterType: { filterValue, filterComboBoxValue: combo },
  });

  test("turns the Summary's click-to-filter rows into table rules", () => {
    expect(
      filterValueToTableFilter(
        row(TSurveyElementTypeEnum.MultipleChoiceMulti, "plan", "Includes either", ["Pro"]),
        survey
      )
    ).toEqual({ property: "question.plan", operator: "includesOneOf", values: ["Pro"] });
    expect(
      filterValueToTableFilter(row(TSurveyElementTypeEnum.NPS, "nps", "Is equal to", "9"), survey)
    ).toEqual({
      property: "question.nps",
      operator: "equals",
      values: ["9"],
    });
    expect(filterValueToTableFilter(row(TSurveyElementTypeEnum.NPS, "nps", "Submitted"), survey)).toEqual({
      property: "question.nps",
      operator: "isSet",
      values: [],
    });
    expect(
      filterValueToTableFilter(row(TSurveyElementTypeEnum.OpenText, "feedback", "is", "Skipped"), survey)
    ).toEqual({
      property: "question.feedback",
      operator: "isNotSet",
      values: [],
    });
    expect(
      filterValueToTableFilter(row(TSurveyElementTypeEnum.Matrix, "grid", "Speed", "Good"), survey)
    ).toEqual({
      property: "question.grid.r1",
      operator: "equals",
      values: ["Good"],
    });
  });

  test("round-trips: a rule made from a Summary click filters the same as the click did", () => {
    const click = row(TSurveyElementTypeEnum.MultipleChoiceMulti, "plan", "Includes either", ["Free"]);
    const fromClick = getFormattedFilters(
      survey,
      { filter: [click], responseStatus: "all" },
      { from: undefined }
    );
    const rule = filterValueToTableFilter(click, survey)!;
    expect(criteriaFor([rule])).toEqual(fromClick);
  });

  test("ignores rows that are not questions", () => {
    expect(
      filterValueToTableFilter(
        {
          elementType: { type: OptionsType.TAGS, id: "t", label: "t" },
          filterType: { filterValue: "is", filterComboBoxValue: undefined },
        },
        survey
      )
    ).toBeNull();
  });
});

describe("isQuestionFilter", () => {
  test("matches a question and its matrix rows, not a question whose id merely starts the same", () => {
    expect(isQuestionFilter({ property: "question.grid", operator: "isSet", values: [] }, "grid")).toBe(true);
    expect(
      isQuestionFilter({ property: "question.grid.r1", operator: "equals", values: ["x"] }, "grid")
    ).toBe(true);
    expect(isQuestionFilter({ property: "question.gridx", operator: "isSet", values: [] }, "grid")).toBe(
      false
    );
  });
});

describe("normalizeSummaryFilterRow", () => {
  const german = ((key: string) =>
    ({
      "workspace.surveys.summary.includes_either": "Enthält eines von",
      "workspace.surveys.summary.is_equal_to": "Ist gleich",
      "common.skipped": "Übersprungen",
    })[key] ?? key) as unknown as TFunction;

  test("maps a translated Summary operator back, so a click filters in every language", () => {
    const row = {
      elementType: {
        type: OptionsType.ELEMENTS,
        id: "plan",
        label: "plan",
        elementType: TSurveyElementTypeEnum.MultipleChoiceMulti,
      },
      filterType: { filterValue: "Enthält eines von", filterComboBoxValue: ["Pro"] },
    };
    expect(filterValueToTableFilter(row, survey)).toBeNull();
    expect(filterValueToTableFilter(normalizeSummaryFilterRow(row, german), survey)).toEqual({
      property: "question.plan",
      operator: "includesOneOf",
      values: ["Pro"],
    });
  });

  test("maps the NPS dismissed link's translated Skipped", () => {
    const row = {
      elementType: {
        type: OptionsType.ELEMENTS,
        id: "nps",
        label: "nps",
        elementType: TSurveyElementTypeEnum.NPS,
      },
      filterType: { filterValue: "Übersprungen", filterComboBoxValue: undefined },
    };
    expect(filterValueToTableFilter(normalizeSummaryFilterRow(row, german), survey)).toEqual({
      property: "question.nps",
      operator: "isNotSet",
      values: [],
    });
  });

  test("maps translated picture names to the option values", () => {
    const row = {
      elementType: {
        type: OptionsType.ELEMENTS,
        id: "pics",
        label: "pics",
        elementType: TSurveyElementTypeEnum.PictureSelection,
      },
      filterType: { filterValue: "Includes all", filterComboBoxValue: ["Bild 2"] },
    };
    expect(normalizeSummaryFilterRow(row, german).filterType.filterComboBoxValue).toEqual(["Picture 2"]);
  });
});

describe("applicableResponseFilters", () => {
  test("a second rule on one question replaces the first, so the chips show what applies", () => {
    const filters: TTableFilter[] = [
      { property: "question.rating", operator: "greaterThan", values: ["3"] },
      { property: "status", operator: "in", values: ["complete"] },
      { property: "question.rating", operator: "lessThan", values: ["2"] },
    ];
    expect(applicableResponseFilters(filters)).toEqual([filters[1], filters[2]]);
  });

  test("tag rules stack", () => {
    const filters: TTableFilter[] = [
      { property: "tag", operator: "in", values: ["vip"] },
      { property: "tag", operator: "equals", values: ["churn"] },
    ];
    expect(applicableResponseFilters(filters)).toEqual(filters);
  });
});
