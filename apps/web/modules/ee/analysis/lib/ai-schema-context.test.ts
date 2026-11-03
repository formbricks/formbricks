import { describe, expect, test } from "vitest";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { CHART_TYPE_IDS } from "@/modules/ee/analysis/types/analysis";
import { generateSchemaContext } from "./ai-schema-context";

describe("AI schema context", () => {
  test.each([
    [
      "the responses alias, distinct from the unique-submissions measure it could be confused with",
      '"responses", "response count", or "feedback records" means `FeedbackRecords.count` — not `FeedbackRecords.uniqueResponses`',
    ],
    [
      "the NPS score alias for the canonical score measure",
      '"NPS score" or "net promoter score" means `FeedbackRecords.npsScore`',
    ],
    [
      "the NPS average alias, distinct from the NPS score",
      '"NPS value", "NPS average", or "NPS average rating" means `FeedbackRecords.npsAverage`',
    ],
    ["the CSAT score alias", '"CSAT score" means `FeedbackRecords.csatScore`'],
    [
      "the NPS answer count alias",
      '"how many NPS answers" or "NPS responses" means `FeedbackRecords.npsCount`',
    ],
    [
      "the NPS breakdown recipe over the value band",
      '"NPS breakdown" or "promoters vs passives vs detractors" means measure `FeedbackRecords.npsCount`, dimension `FeedbackRecords.valueBand`, filter `FeedbackRecords.fieldType` equals ["nps"]',
    ],
    [
      "the CSAT breakdown recipe over the value band",
      '"CSAT breakdown" or "satisfied vs neutral vs dissatisfied" means measure `FeedbackRecords.csatCount`, dimension `FeedbackRecords.valueBand`, filter `FeedbackRecords.fieldType` equals ["csat"]',
    ],
    [
      "the exact value band tokens for equals filtering",
      "promoter, passive, detractor (NPS) and satisfied, neutral, dissatisfied (CSAT)",
    ],
    ["the CSAT average alias", '"CSAT average" means `FeedbackRecords.csatAverage`'],
    ["the CES alias", '"CES average" or "CES score" means `FeedbackRecords.cesAverage`'],
    [
      "the rating average alias",
      '"rating average" or "average rating" means `FeedbackRecords.ratingAverage`',
    ],
    [
      "the sentiment average alias",
      '"average sentiment" or "sentiment trend" means `FeedbackRecords.sentimentAverage`',
    ],
    [
      "the per-record sentiment score dimension, distinct from the average",
      '"sentiment score" (e.g. filtering records by score) means the `FeedbackRecords.sentimentScore` dimension',
    ],
    [
      "the exact sentiment enum tokens for equals filtering",
      "very_negative, negative, neutral, positive, very_positive, mixed. Filter it with `equals`/`notEquals`",
    ],
    ["the exact emotion tokens", "joy, anger, sadness, fear, surprise, disgust"],
    ["that emotions must never be filtered with equals", "never use `equals` on it"],
    [
      "the contains-over-equals preference for free-text dimensions",
      "prefer the `contains` operator over `equals`",
    ],
    ["sourceName among the free-text dimensions", "`FeedbackRecords.sourceName`"],
  ])("documents %s", (_description, expectedSnippet) => {
    expect(generateSchemaContext()).toContain(expectedSnippet);
  });

  // The prompt and the output schema both derive from the shared preset list, so the model can only ask
  // for windows the summary filter and the dashboards offer too. Hardcode either and this fails.
  test("offers every shared date preset", () => {
    const context = generateSchemaContext();
    for (const preset of DATE_RANGE_PRESETS) {
      expect(context).toContain(`"${preset}"`);
    }
  });

  test("offers exactly the chart types the output schema accepts", () => {
    const context = generateSchemaContext();
    const guideline = context.split("\n").find((line) => line.includes("most appropriate chart type"));

    expect(guideline).toBeDefined();
    for (const id of CHART_TYPE_IDS) {
      expect(guideline).toContain(`\`${id}\``);
    }
    // Only the ids are backticked, so this catches `line` being offered as a type again without
    // tripping on the prose that tells the model area covers a line rendering. Steering the model
    // at `line` would produce a value ZChartType rejects inside generateObject — before
    // resolveChartType's legacy alias could rescue it.
    expect(guideline).not.toContain("`line`");
  });
});

describe("AI schema context for one dataset (ENG-6893, ENG-6894)", () => {
  const dataset = {
    embeddedFields: [
      { name: "FeedbackRecords.ed_area_manager_1a2b3c4d", key: "Area Manager" },
      { name: "FeedbackRecords.ed_o_brien_s_00000000", key: "O'Brien's \"quote\"" },
    ],
    answerQuestions: [
      {
        id: "q_delivery",
        label: "How was delivery?",
        kind: "choice" as const,
        options: [
          { value: "opt_late", label: "Late" },
          { value: "opt_early", label: "Early" },
        ],
      },
      {
        id: "q_feat",
        label: "Features",
        kind: "multi" as const,
        options: [{ value: "opt_a", label: "Surveys" }],
      },
    ],
  };

  test("is unchanged for a dataset without embedded data or answerable questions", () => {
    expect(generateSchemaContext({ embeddedFields: [], answerQuestions: [] })).toBe(generateSchemaContext());
    expect(generateSchemaContext()).not.toContain("FeedbackRecords.answer");
  });

  test("lists embedded keys by their original names, quoted as data", () => {
    const context = generateSchemaContext(dataset);

    expect(context).toContain('- FeedbackRecords.ed_area_manager_1a2b3c4d: embedded data "Area Manager"');
    expect(context).toContain(`embedded data ${JSON.stringify("O'Brien's \"quote\"")}`);
  });

  test("lists the answerable questions with their ids, kinds and value keys, and the recipe", () => {
    const context = generateSchemaContext(dataset);

    expect(context).toContain(
      '- "q_delivery" (choice) "How was delivery?": "opt_late" = "Late", "opt_early" = "Early"'
    );
    expect(context).toContain('- "q_feat" (multi) "Features": "opt_a" = "Surveys"');
    expect(context).toContain('"NPS when delivery was late"');
    expect(context).toContain('a multi question has no "does not contain"');
  });
});
