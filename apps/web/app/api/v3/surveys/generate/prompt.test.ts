import { describe, expect, test } from "vitest";
import {
  GENERATED_SURVEY_ELEMENT_TYPES,
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
} from "./constants";
import { buildV3SurveyGenerationPrompt, buildV3SurveyGenerationSystemPrompt } from "./prompt";
import { V3_SURVEY_GENERATE_ALLOWED_LOCALES } from "./schemas";

describe("v3 survey generation prompt", () => {
  test("keeps the system prompt provider neutral and bounded to supported survey capabilities", () => {
    const system = buildV3SurveyGenerationSystemPrompt(V3_SURVEY_GENERATE_ALLOWED_LOCALES, "link");

    expect(system).toContain("Formbricks survey drafts");
    expect(system).toContain(`Use only these question types: ${GENERATED_SURVEY_ELEMENT_TYPES.join(", ")}`);
    expect(system).toContain("csat");
    expect(system).toContain("ces");
    expect(system).toContain("ranking");
    expect(system).toContain("matrix");
    expect(system).toContain("date");
    expect(system).toContain("Do not use file uploads");
    expect(system).toContain("link survey draft");
    expect(system).toContain('string values "5", "7", or "10"');
    expect(system).toContain('For csat questions, set range to "5"');
    expect(system).toContain(
      `Group questions into ${GENERATED_SURVEY_MIN_BLOCKS} to ${GENERATED_SURVEY_MAX_BLOCKS} blocks`
    );
    expect(system).toContain(
      `Use ${GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK} to ${GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK} questions per block`
    );
    expect(system.toLowerCase()).not.toContain("openai");
  });

  test("instructs the model to match the prompt language and fall back to the preferred language", () => {
    const system = buildV3SurveyGenerationSystemPrompt(V3_SURVEY_GENERATE_ALLOWED_LOCALES, "link");
    const prompt = buildV3SurveyGenerationPrompt(
      "Mide product-market fit para usuarios activos",
      "link",
      "es-ES",
      V3_SURVEY_GENERATE_ALLOWED_LOCALES
    );
    const allowedSurveyLanguages = `Allowed survey languages: ${V3_SURVEY_GENERATE_ALLOWED_LOCALES.join(", ")}.`;

    expect(system).toContain("same language as the user's request");
    expect(system).toContain(
      "Return the survey language exactly as one of the allowed survey language codes"
    );
    expect(system).toContain(allowedSurveyLanguages);
    expect(prompt).toContain("Use the same language as the request");
    expect(prompt).toContain("If the request language is unclear");
    expect(prompt).toContain("include a short button label");
    expect(prompt).toContain(allowedSurveyLanguages);
    expect(prompt).toContain("Preferred survey language: es-ES");
    expect(prompt).toContain("exactly one allowed survey language code");
  });

  test("includes the user request without adding vendor-specific instructions", () => {
    const prompt = buildV3SurveyGenerationPrompt(
      "Collect product onboarding feedback",
      "link",
      "en-US",
      V3_SURVEY_GENERATE_ALLOWED_LOCALES
    );

    expect(prompt).toContain("Create a draft link survey");
    expect(prompt).toContain("Collect product onboarding feedback");
    expect(prompt.toLowerCase()).not.toContain("openai");
  });
});
