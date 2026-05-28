import { describe, expect, test } from "vitest";
import {
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
} from "./constants";
import { buildV3SurveyGenerationPrompt, buildV3SurveyGenerationSystemPrompt } from "./prompt";

describe("v3 survey generation prompt", () => {
  test("keeps the system prompt provider neutral and bounded to supported survey capabilities", () => {
    const system = buildV3SurveyGenerationSystemPrompt();

    expect(system).toContain("Formbricks survey drafts");
    expect(system).toContain("openText");
    expect(system).toContain("multipleChoiceSingle");
    expect(system).toContain("link survey draft");
    expect(system).toContain(
      `Group questions into ${GENERATED_SURVEY_MIN_BLOCKS} to ${GENERATED_SURVEY_MAX_BLOCKS} blocks`
    );
    expect(system).toContain(
      `Use ${GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK} to ${GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK} questions per block`
    );
    expect(system.toLowerCase()).not.toContain("openai");
  });

  test("instructs the model to match the prompt language and fall back to English", () => {
    const system = buildV3SurveyGenerationSystemPrompt();
    const prompt = buildV3SurveyGenerationPrompt("Mide product-market fit para usuarios activos");

    expect(system).toContain("same language as the user's request");
    expect(system).toContain("if uncertain, use English");
    expect(prompt).toContain("Use the same language as the request");
    expect(prompt).toContain("If the language is unclear, use English");
  });

  test("includes the user request without adding vendor-specific instructions", () => {
    const prompt = buildV3SurveyGenerationPrompt("Collect product onboarding feedback");

    expect(prompt).toContain("Collect product onboarding feedback");
    expect(prompt.toLowerCase()).not.toContain("openai");
  });
});
