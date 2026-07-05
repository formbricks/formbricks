import { describe, expect, test, vi } from "vitest";
import {
  AI_CHART_PROMPT_ERROR_CODE,
  AI_QUOTA_EXCEEDED_ERROR_CODE,
  getTranslatedAIChartError,
} from "./ai-chart-errors";

describe("AI chart errors", () => {
  test("translates the prompt conversion error code", () => {
    const t = vi.fn((key: string) => `translated:${key}`);

    expect(getTranslatedAIChartError(AI_CHART_PROMPT_ERROR_CODE, t)).toBe(
      "translated:workspace.analysis.charts.ai_prompt_could_not_be_converted"
    );
  });

  test("translates the quota exceeded error code", () => {
    const t = vi.fn((key: string) => `translated:${key}`);

    expect(getTranslatedAIChartError(AI_QUOTA_EXCEEDED_ERROR_CODE, t)).toBe(
      "translated:workspace.analysis.charts.ai_quota_exceeded"
    );
  });

  test("passes unknown error strings through unchanged", () => {
    const t = vi.fn((key: string) => `translated:${key}`);

    expect(getTranslatedAIChartError("SOMETHING_ELSE", t)).toBe("SOMETHING_ELSE");
    expect(t).not.toHaveBeenCalled();
  });
});
