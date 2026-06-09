import { describe, expect, test, vi } from "vitest";
import { AI_CHART_PROMPT_ERROR_CODE, getTranslatedAIChartError } from "./ai-chart-errors";

describe("AI chart errors", () => {
  test("translates the prompt conversion error code", () => {
    const t = vi.fn((key: string) => `translated:${key}`);

    expect(getTranslatedAIChartError(AI_CHART_PROMPT_ERROR_CODE, t as any)).toBe(
      "translated:workspace.analysis.charts.ai_prompt_could_not_be_converted"
    );
  });

  test("passes unknown error strings through unchanged", () => {
    const t = vi.fn((key: string) => `translated:${key}`);

    expect(getTranslatedAIChartError("SOMETHING_ELSE", t as any)).toBe("SOMETHING_ELSE");
    expect(t).not.toHaveBeenCalled();
  });
});
