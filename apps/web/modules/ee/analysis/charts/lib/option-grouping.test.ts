import { beforeEach, describe, expect, test, vi } from "vitest";
import { pruneOptionLabels, resolveOptionGrouping } from "./option-grouping";

const mocks = vi.hoisted(() => ({
  getFeedbackSourcesWithMappings: vi.fn(),
  getSurvey: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourcesWithMappings: mocks.getFeedbackSourcesWithMappings,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

/** A survey carrying a single element, shaped the way getElementsFromBlocks reads it. */
const surveyWith = (id: string, element: Record<string, unknown>) => ({
  id,
  blocks: [{ id: `block-${id}`, elements: [element] }],
});

const singleSelect = (id: string, headline: string, choices: { id: string; label: string }[]) => ({
  id,
  type: "multipleChoiceSingle",
  headline: { default: headline },
  choices: choices.map((c) => ({ id: c.id, label: { default: c.label } })),
});

const multiSelect = (id: string, headline: string, choices: { id: string; label: string }[]) => ({
  ...singleSelect(id, headline, choices),
  type: "multipleChoiceMulti",
});

/** Wire the workspace's mappings and the surveys they point at. */
const givenWorkspace = (
  entries: { mapping: Record<string, unknown>; survey: ReturnType<typeof surveyWith> }[]
) => {
  mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
    { formbricksMappings: entries.map((e) => e.mapping) },
  ]);
  mocks.getSurvey.mockImplementation(
    async (surveyId: string) => entries.find((e) => e.survey.id === surveyId)?.survey
  );
};

const groupByValueId = (filters: unknown[] = []) => ({
  measures: ["FeedbackRecords.count"],
  dimensions: ["FeedbackRecords.valueId"],
  filters,
});

const fieldIdFilter = (value: string) => ({
  member: "FeedbackRecords.fieldId",
  operator: "equals",
  values: [value],
});

const fieldLabelFilter = (value: string) => ({
  member: "FeedbackRecords.fieldLabel",
  operator: "equals",
  values: [value],
});

describe("resolveOptionGrouping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("leaves a query that groups by neither value dimension untouched", async () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.fieldLabel"],
      filters: [],
    };

    const result = await resolveOptionGrouping(query as never, "workspace-1");

    expect(result.optionLabels).toBeUndefined();
    expect(result.rewrittenQuery).toBe(query);
    expect(mocks.getFeedbackSourcesWithMappings).not.toHaveBeenCalled();
  });

  test("labels a single-select pinned by an exact fieldId filter", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-single", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith(
          "survey-1",
          singleSelect("el-single", "Nationality", [
            { id: "c-in", label: "India" },
            { id: "c-nl", label: "Netherlands" },
          ])
        ),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-single")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "c-in": "India", "c-nl": "Netherlands" });
  });

  // ENG-3140: multi-select and matrix records store field_id as `${elementId}__${optionId}`, so a
  // Field ID filter never equalled the mapping's elementId and the whole map was dropped.
  test("labels a multi-select pinned by a per-option fieldId (elementId__optionId)", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-multi", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith(
          "survey-1",
          multiSelect("el-multi", "Sports followed", [
            { id: "c-cricket", label: "Cricket" },
            { id: "c-hockey", label: "Hockey" },
          ])
        ),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-multi__c-cricket")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "c-cricket": "Cricket", "c-hockey": "Hockey" });
  });

  // ENG-3140: the old ambiguity guard returned undefined when 2+ mappings shared a field label,
  // which is exactly the Asia Cup shape — the same question asked across several surveys.
  test("merges labels from every mapping sharing the filtered field label", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-a", surveyId: "survey-a", customFieldLabel: null },
        survey: surveyWith("survey-a", singleSelect("el-a", "Nationality", [{ id: "c-in", label: "India" }])),
      },
      {
        mapping: { elementId: "el-b", surveyId: "survey-b", customFieldLabel: null },
        survey: surveyWith(
          "survey-b",
          singleSelect("el-b", "Nationality", [{ id: "c-pk", label: "Pakistan" }])
        ),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldLabelFilter("Nationality")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "c-in": "India", "c-pk": "Pakistan" });
  });

  // ENG-3140: free-text "other" answers are ingested under the stable "other" value_id. Editor-built
  // surveys carry a choice with that id, but an element that only sets otherOptionPlaceholder does
  // not — and that bucket used to render the bare id.
  test("labels the free-text other bucket when the element carries no explicit other choice", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-single", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith("survey-1", {
          ...singleSelect("el-single", "Nationality", [{ id: "c-in", label: "India" }]),
          otherOptionPlaceholder: { default: "Please specify" },
        }),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-single")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "c-in": "India", other: "Other" });
  });

  test("prefers the survey's own other-choice label over the fallback", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-single", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith(
          "survey-1",
          singleSelect("el-single", "Nationality", [
            { id: "c-in", label: "India" },
            { id: "other", label: "Somewhere else" },
          ])
        ),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-single")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "c-in": "India", other: "Somewhere else" });
  });

  // ENG-3140: matrix records store the matched *column* id in value_id.
  test("labels a matrix by its column ids", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-matrix", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith("survey-1", {
          id: "el-matrix",
          type: "matrix",
          headline: { default: "Rate each area" },
          rows: [{ id: "r-1", label: { default: "Support" } }],
          columns: [
            { id: "col-good", label: { default: "Good" } },
            { id: "col-bad", label: { default: "Bad" } },
          ],
        }),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-matrix__r-1")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toEqual({ "col-good": "Good", "col-bad": "Bad" });
  });

  // ENG-3140: with no field filter at all the resolver used to give up, which is the reported
  // dashboard's shape. Ids are cuids, so labelling from the whole workspace cannot mislabel.
  test("falls back to the whole workspace when a valueId grouping pins no mapping", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-a", surveyId: "survey-a", customFieldLabel: null },
        survey: surveyWith("survey-a", singleSelect("el-a", "Nationality", [{ id: "c-in", label: "India" }])),
      },
      {
        mapping: { elementId: "el-b", surveyId: "survey-b", customFieldLabel: null },
        survey: surveyWith(
          "survey-b",
          multiSelect("el-b", "Sports followed", [{ id: "c-cricket", label: "Cricket" }])
        ),
      },
    ]);

    const result = await resolveOptionGrouping(groupByValueId() as never, "workspace-1");

    expect(result.optionLabels).toEqual({ "c-in": "India", "c-cricket": "Cricket" });
  });

  test("does not widen to the whole workspace for a valueText grouping", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-a", surveyId: "survey-a", customFieldLabel: null },
        survey: surveyWith("survey-a", singleSelect("el-a", "Nationality", [{ id: "c-in", label: "India" }])),
      },
    ]);

    const result = await resolveOptionGrouping(
      {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.valueText"],
        filters: [],
      } as never,
      "workspace-1"
    );

    expect(result.optionLabels).toBeUndefined();
    expect(mocks.getSurvey).not.toHaveBeenCalled();
  });

  test("omits optionLabels when the pinned element carries no option ids", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-open", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith("survey-1", {
          id: "el-open",
          type: "openText",
          headline: { default: "Anything else?" },
        }),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-open")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toBeUndefined();
  });

  // Ranking stores the rank in value_number and picture selection falls through the generic path,
  // so neither writes a value_id — there is no bucket for this resolver to label.
  test("omits optionLabels for a ranking element, which stores no value_id", async () => {
    givenWorkspace([
      {
        mapping: { elementId: "el-rank", surveyId: "survey-1", customFieldLabel: null },
        survey: surveyWith("survey-1", {
          id: "el-rank",
          type: "ranking",
          headline: { default: "Rank these" },
          choices: [
            { id: "c-1", label: { default: "First" } },
            { id: "c-2", label: { default: "Second" } },
          ],
        }),
      },
    ]);

    const result = await resolveOptionGrouping(
      groupByValueId([fieldIdFilter("el-rank__c-1")]) as never,
      "workspace-1"
    );

    expect(result.optionLabels).toBeUndefined();
  });
});

describe("pruneOptionLabels", () => {
  const labels = { "c-in": "India", "c-pk": "Pakistan", "c-unrelated": "From another survey" };

  test("keeps only the labels the returned rows actually render", () => {
    const rows = [
      { "FeedbackRecords.valueId": "c-in", "FeedbackRecords.count": 12 },
      { "FeedbackRecords.valueId": "c-pk", "FeedbackRecords.count": 7 },
    ];

    expect(pruneOptionLabels(groupByValueId() as never, rows, labels)).toEqual({
      "c-in": "India",
      "c-pk": "Pakistan",
    });
  });

  test("passes the map through untouched for a grouping that carries no value_id", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [],
    };

    expect(pruneOptionLabels(query as never, [{ "FeedbackRecords.valueText": "India" }], labels)).toBe(
      labels
    );
  });

  test("drops the map entirely when no row matches it", () => {
    const rows = [{ "FeedbackRecords.valueId": "c-gone", "FeedbackRecords.count": 1 }];

    expect(pruneOptionLabels(groupByValueId() as never, rows, labels)).toBeUndefined();
  });
});
