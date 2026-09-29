import { describe, expect, test } from "vitest";
import { AI_CHART_PROMPT_MAX_LENGTH, canGenerateChart, getChartHelperPrompts } from "./ai-chart-prompts";

const t = ((key: string) => key) as never;

describe("getChartHelperPrompts", () => {
  test("offers four starting points, each with its own copy", () => {
    const prompts = getChartHelperPrompts(t);

    expect(prompts).toHaveLength(4);
    expect(new Set(prompts.map((p) => p.label)).size).toBe(4);
    expect(new Set(prompts.map((p) => p.prompt)).size).toBe(4);
  });

  test("every entry resolves a label, a prompt and an icon", () => {
    for (const prompt of getChartHelperPrompts(t)) {
      expect(prompt.label).toBeTruthy();
      expect(prompt.prompt).toBeTruthy();
      expect(prompt.Icon).toBeTruthy();
    }
  });

  test("a helper prompt always fits the field it fills", () => {
    // The buttons write straight into the textarea, so a prompt longer than its maxLength would be
    // silently truncated into something the user never wrote.
    for (const prompt of getChartHelperPrompts(((key: string) => key.repeat(3)) as never)) {
      expect(prompt.prompt.length).toBeLessThanOrEqual(AI_CHART_PROMPT_MAX_LENGTH);
    }
  });
});

describe("canGenerateChart", () => {
  test("needs a prompt with something in it", () => {
    expect(canGenerateChart("responses per week", true, false, true)).toBe(true);
    expect(canGenerateChart("", true, false, true)).toBe(false);
    expect(canGenerateChart("   ", true, false, true)).toBe(false);
  });

  test("blocks while AI is unavailable or a run is already in flight", () => {
    expect(canGenerateChart("responses per week", false, false, true)).toBe(false);
    expect(canGenerateChart("responses per week", true, true, true)).toBe(false);
    // Without a feedback directory there is nothing to query: the action would return silently and
    // the button would sit there looking live.
    expect(canGenerateChart("responses per week", true, false, false)).toBe(false);
  });
});
