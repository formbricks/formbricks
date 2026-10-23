import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { toJsWorkspaceStateSurvey } from "./client-utils";

describe("toJsWorkspaceStateSurvey", () => {
  test("drops the stored custom CSS, whose source must never reach the renderer or a respondent", () => {
    const survey = {
      id: "s1",
      segment: null,
      customCss: { light: { source: "a{}", compiled: "x" }, dark: null, processorVersion: 1 },
    } as unknown as TSurvey;

    const jsSurvey = toJsWorkspaceStateSurvey(survey);

    expect(jsSurvey).not.toHaveProperty("customCss");
    expect(jsSurvey).toMatchObject({ id: "s1", segment: null });
  });

  test("reshapes the segment to what the SDK reads", () => {
    const survey = {
      id: "s1",
      segment: { id: "seg1", filters: [{ id: "f" }] },
    } as unknown as TSurvey;

    expect(toJsWorkspaceStateSurvey(survey).segment).toEqual({ id: "seg1", hasFilters: true });
  });
});
