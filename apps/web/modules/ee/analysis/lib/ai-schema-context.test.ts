import { describe, expect, test } from "vitest";
import { generateSchemaContext } from "./ai-schema-context";

describe("AI schema context", () => {
  test.each([
    [
      "the NPS score alias for the canonical score measure",
      '"NPS score" or "net promoter score" means `FeedbackRecords.npsScore`',
    ],
    [
      "the NPS average alias, distinct from the NPS score",
      '"NPS value", "NPS average", or "NPS average rating" means `FeedbackRecords.npsAverage`',
    ],
    ["the CSAT score alias", '"CSAT score" means `FeedbackRecords.csatScore`'],
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
});
