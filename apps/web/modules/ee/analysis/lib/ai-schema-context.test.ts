import { describe, expect, test } from "vitest";
import { generateSchemaContext } from "./ai-schema-context";

describe("AI schema context", () => {
  test("documents NPS score aliases for the canonical score measure", () => {
    const context = generateSchemaContext();

    expect(context).toContain('"NPS score" or "net promoter score" means `FeedbackRecords.npsScore`');
  });

  test("distinguishes NPS score from NPS average prompts", () => {
    const context = generateSchemaContext();

    expect(context).toContain(
      '"NPS value", "NPS average", or "NPS average rating" means `FeedbackRecords.npsAverage`'
    );
  });

  test("documents CSAT score and average aliases", () => {
    const context = generateSchemaContext();

    expect(context).toContain('"CSAT score" means `FeedbackRecords.csatScore`');
    expect(context).toContain('"CSAT average" means `FeedbackRecords.csatAverage`');
  });

  test("documents CES aliases", () => {
    const context = generateSchemaContext();

    expect(context).toContain('"CES average" or "CES score" means `FeedbackRecords.cesAverage`');
  });

  test("documents the sentiment average alias and distinguishes the per-record score", () => {
    const context = generateSchemaContext();

    expect(context).toContain(
      '"average sentiment" or "sentiment trend" means `FeedbackRecords.sentimentAverage`'
    );
    expect(context).toContain(
      '"sentiment score" (e.g. filtering records by score) means the `FeedbackRecords.sentimentScore` dimension'
    );
  });

  test("documents the exact sentiment enum tokens for equals filtering", () => {
    const context = generateSchemaContext();

    expect(context).toContain(
      "very_negative, negative, neutral, positive, very_positive, mixed. Filter it with `equals`/`notEquals`"
    );
  });

  test("steers emotions filtering toward contains with exact tokens", () => {
    const context = generateSchemaContext();

    expect(context).toContain("joy, anger, sadness, fear, surprise, disgust");
    expect(context).toContain("never use `equals` on it");
  });

  test("steers free-text dimension filters toward contains over equals", () => {
    const context = generateSchemaContext();

    expect(context).toContain("prefer the `contains` operator over `equals`");
    expect(context).toContain("`FeedbackRecords.sourceName`");
  });
});
