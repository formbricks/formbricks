import { describe, expect, test } from "vitest";
import { GENERATED_SURVEY_MAX_BLOCKS, GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK } from "./constants";
import { ZGeneratedSurveyDraft } from "./schemas";

function generatedQuestion(index: number) {
  return {
    type: "openText" as const,
    headline: `Question ${index}`,
    subheader: null,
    required: false,
    placeholder: null,
    longAnswer: true,
    choices: null,
    lowerLabel: null,
    upperLabel: null,
    scale: null,
    range: null,
  };
}

function generatedBlock(index: number, questionCount = 1) {
  return {
    name: `Block ${index}`,
    questions: Array.from({ length: questionCount }, (_, questionIndex) =>
      generatedQuestion(questionIndex + 1)
    ),
  };
}

describe("ZGeneratedSurveyDraft", () => {
  test("allows up to the configured number of generated blocks", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: Array.from({ length: GENERATED_SURVEY_MAX_BLOCKS }, (_, index) => generatedBlock(index + 1)),
      ending: null,
    });

    expect(result.success).toBe(true);
  });

  test("limits generated questions per block", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [generatedBlock(1, GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK + 1)],
      ending: null,
    });

    expect(result.success).toBe(false);
  });
});
