import { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import {
  AI_SURVEY_PROMPT_MAX_LENGTH,
  AI_SURVEY_PROMPT_MIN_LENGTH,
  SURVEY_TYPE_OPTIONS,
  getHelperPrompts,
  getUnavailableMessageKey,
} from "./ai-create-utils";

describe("ai-create-utils", () => {
  test("defines prompt limits and supported survey types", () => {
    expect(AI_SURVEY_PROMPT_MIN_LENGTH).toBe(4);
    expect(AI_SURVEY_PROMPT_MAX_LENGTH).toBe(1200);
    expect(SURVEY_TYPE_OPTIONS).toEqual([{ value: "link" }, { value: "app" }]);
  });

  test("returns the unavailable message key for each AI reason", () => {
    expect(getUnavailableMessageKey("read_only")).toBe(
      "workspace.surveys.read_only_user_not_allowed_to_create_survey_warning"
    );
    expect(getUnavailableMessageKey("not_in_plan")).toBe("workspace.surveys.ai_create.ai_not_in_plan");
    expect(getUnavailableMessageKey("not_enabled")).toBe("workspace.surveys.ai_create.ai_not_enabled");
    expect(getUnavailableMessageKey("instance_not_configured")).toBe(
      "workspace.surveys.ai_create.ai_instance_not_configured"
    );
    expect(getUnavailableMessageKey()).toBe("workspace.surveys.ai_create.ai_not_available");
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
