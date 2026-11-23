import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { newerSurvey } from "./newer-survey";

const survey = (updatedAt: string, name = "Survey") =>
  ({ id: "clsurvey111111111111111111", name, updatedAt: new Date(updatedAt) }) as TSurvey;

describe("newerSurvey", () => {
  test("takes a save's answer over the copy the page rendered", () => {
    const rendered = survey("2026-11-11T10:00:00Z", "Rendered");
    const saved = survey("2026-11-11T10:00:05Z", "Saved");
    expect(newerSurvey(rendered, saved)).toBe(saved);
  });

  test("keeps the last save when a server render older than it arrives", () => {
    const saved = survey("2026-11-11T10:00:05Z", "Saved");
    const staleRender = survey("2026-11-11T10:00:00Z", "Stale render");
    expect(newerSurvey(saved, staleRender)).toBe(saved);
  });

  test("takes a server render as new as the current copy, so a refresh can't be ignored", () => {
    const current = survey("2026-11-11T10:00:05Z", "Current");
    const rerendered = survey("2026-11-11T10:00:05Z", "Rerendered");
    expect(newerSurvey(current, rerendered)).toBe(rerendered);
  });
});
