import { describe, expect, test } from "vitest";
import { isV3SurveyGeneratePromptDetailed } from "./prompt-detail";

describe("isV3SurveyGeneratePromptDetailed", () => {
  test.each([
    ["superhuman PMF", false], // 14 characters, 2 words
    ["why do new users churn", false], // 22 characters, 5 words: too short
    ["onboarding-feedback-survey-for-trial", false], // 36 characters, 1 word: too few words
    ["   why   do   new   users   ", false], // 22 characters once trimmed
    ["create an onboarding survey", true], // 27 characters, 4 words
    ["  create an onboarding survey  ", true],
  ])("%j is detailed: %s", (prompt, expected) => {
    expect(isV3SurveyGeneratePromptDetailed(prompt)).toBe(expected);
  });
});
