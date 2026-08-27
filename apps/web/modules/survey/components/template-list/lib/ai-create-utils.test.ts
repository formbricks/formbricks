import { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import {
  AI_SURVEY_PROMPT_MAX_LENGTH,
  AI_SURVEY_PROMPT_MIN_LENGTH,
  getHelperPrompts,
} from "./ai-create-utils";

describe("ai-create-utils", () => {
  test("defines prompt limits", () => {
    expect(AI_SURVEY_PROMPT_MIN_LENGTH).toBe(4);
    expect(AI_SURVEY_PROMPT_MAX_LENGTH).toBe(1200);
  });

  test("builds helper prompts with translated labels and prompts", () => {
    const tMock = vi.fn((key: string) => key) as unknown as TFunction;

    const result = getHelperPrompts(tMock);

    expect(result.map(({ label, prompt }) => ({ label, prompt }))).toEqual([
      {
        label: "workspace.surveys.ai_create.prompt_helper_onboarding_label",
        prompt: "workspace.surveys.ai_create.prompt_helper_onboarding",
      },
      {
        label: "workspace.surveys.ai_create.prompt_helper_churn_label",
        prompt: "workspace.surveys.ai_create.prompt_helper_churn",
      },
      {
        label: "workspace.surveys.ai_create.prompt_helper_pmf_label",
        prompt: "workspace.surveys.ai_create.prompt_helper_pmf",
      },
      {
        label: "workspace.surveys.ai_create.prompt_helper_website_label",
        prompt: "workspace.surveys.ai_create.prompt_helper_website",
      },
    ]);
    expect(result.every(({ Icon }) => Boolean(Icon))).toBe(true);
  });
});
