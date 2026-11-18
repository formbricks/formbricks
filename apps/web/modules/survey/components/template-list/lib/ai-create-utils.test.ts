import { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import { getHelperPrompts } from "./ai-create-utils";

describe("ai-create-utils", () => {
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
    ]);
    expect(result.every(({ Icon }) => Boolean(Icon))).toBe(true);
  });
});
