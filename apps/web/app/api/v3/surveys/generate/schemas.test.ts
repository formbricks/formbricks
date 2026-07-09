import { describe, expect, test } from "vitest";
import {
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH,
} from "./constants";
import { ZGeneratedSurveyDraft, ZGeneratedSurveyDraftForAI, ZV3SurveyGenerateBody } from "./schemas";

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
      language: "en-US",
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
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [generatedBlock(1, GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK + 1)],
      ending: null,
    });

    expect(result.success).toBe(false);
  });

  test("rejects generated survey languages outside the allowed locale enum", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "pt_BR",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [generatedBlock(1)],
      ending: null,
    });

    expect(result.success).toBe(false);
  });

  test("accepts provider-compatible rating range strings and parses them to numbers", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Rating block",
          questions: [
            {
              ...generatedQuestion(1),
              type: "rating",
              scale: "number",
              range: "7",
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks[0].questions[0].range).toBe(7);
    }
  });

  test("accepts numeric rating ranges returned by the model", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Rating block",
          questions: [
            {
              ...generatedQuestion(1),
              type: "rating",
              scale: "number",
              range: 10,
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks[0].questions[0].range).toBe(10);
    }
  });

  test("accepts non-upload generated question types supported by v3 create", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Scored feedback",
          questions: [
            {
              ...generatedQuestion(1),
              type: "csat",
              scale: "number",
              range: "5",
            },
            {
              ...generatedQuestion(2),
              type: "ces",
              scale: "number",
              range: "7",
            },
            {
              ...generatedQuestion(3),
              type: "ranking",
              choices: ["Price", "Reliability", "Support"],
            },
            {
              ...generatedQuestion(4),
              type: "date",
              format: "M-d-y",
            },
          ],
        },
        {
          name: "Matrix feedback",
          questions: [
            {
              ...generatedQuestion(5),
              type: "matrix",
              rows: ["Setup", "Billing"],
              columns: ["Poor", "Good", "Excellent"],
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(true);
  });

  test("rejects generated question types outside the AI generation allowlist", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Unsupported block",
          questions: [
            {
              ...generatedQuestion(1),
              type: "fileUpload",
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(false);
  });

  test("rejects matrix questions without rows and columns", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Matrix feedback",
          questions: [
            {
              ...generatedQuestion(1),
              type: "matrix",
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["blocks.0.questions.0.rows", "blocks.0.questions.0.columns"])
      );
    }
  });

  test("rejects invalid CSAT and CES ranges", () => {
    const result = ZGeneratedSurveyDraft.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Scored feedback",
          questions: [
            {
              ...generatedQuestion(1),
              type: "csat",
              scale: "number",
              range: "7",
            },
            {
              ...generatedQuestion(2),
              type: "ces",
              scale: "number",
              range: "10",
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["blocks.0.questions.0.range", "blocks.0.questions.1.range"])
      );
    }
  });
});

describe("ZGeneratedSurveyDraftForAI", () => {
  test("uses string rating ranges in the provider-facing schema", () => {
    const result = ZGeneratedSurveyDraftForAI.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Rating block",
          questions: [
            {
              ...generatedQuestion(1),
              type: "rating",
              scale: "number",
              range: "5",
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks[0].questions[0].range).toBe("5");
    }
  });

  test("rejects numeric rating ranges before building the provider schema", () => {
    const result = ZGeneratedSurveyDraftForAI.safeParse({
      language: "en-US",
      name: "Generated survey",
      description: null,
      welcomeCard: null,
      blocks: [
        {
          name: "Rating block",
          questions: [
            {
              ...generatedQuestion(1),
              type: "rating",
              scale: "number",
              range: 5,
            },
          ],
        },
      ],
      ending: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("ZV3SurveyGenerateBody", () => {
  test("rejects prompts shorter than the configured minimum", () => {
    const result = ZV3SurveyGenerateBody.safeParse({
      workspaceId: "clxx1234567890123456789012",
      prompt: "x".repeat(V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH - 1),
    });

    expect(result.success).toBe(false);
  });

  test("accepts prompts at the lightweight request minimum", () => {
    const result = ZV3SurveyGenerateBody.safeParse({
      workspaceId: "clxx1234567890123456789012",
      prompt: "x".repeat(V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH),
    });

    expect(result.success).toBe(true);
  });

  test("accepts both link and app survey types and defaults to link", () => {
    const base = {
      workspaceId: "clxx1234567890123456789012",
      prompt: "Measure onboarding completion for new users.",
    };

    expect(ZV3SurveyGenerateBody.parse(base).type).toBe("link");
    expect(ZV3SurveyGenerateBody.parse({ ...base, type: "app" }).type).toBe("app");
    expect(ZV3SurveyGenerateBody.safeParse({ ...base, type: "website" }).success).toBe(false);
  });

  test("normalizes requested survey language aliases into supported app locales", () => {
    const cases = [
      { input: "es_ES", expected: "es-ES" },
      { input: "zh_hans_cn", expected: "zh-Hans-CN" },
      { input: "en", expected: "en-US" },
    ];

    for (const { input, expected } of cases) {
      const result = ZV3SurveyGenerateBody.safeParse({
        workspaceId: "clxx1234567890123456789012",
        prompt: "Measure onboarding completion for new users.",
        language: input,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe(expected);
      }
    }
  });

  test("rejects requested locales outside the AI generation allowlist", () => {
    const result = ZV3SurveyGenerateBody.safeParse({
      workspaceId: "clxx1234567890123456789012",
      prompt: "Measure onboarding completion for new users.",
      language: "it-IT",
    });

    expect(result.success).toBe(false);
  });

  test("normalizes an incomplete script tag to its allowed canonical locale", () => {
    // `zh-Hans` (script, no region) canonicalizes to the allowed `zh-Hans-CN`, so it is accepted.
    const result = ZV3SurveyGenerateBody.safeParse({
      workspaceId: "clxx1234567890123456789012",
      prompt: "Measure onboarding completion for new users.",
      language: "zh-Hans",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("zh-Hans-CN");
    }
  });
});
