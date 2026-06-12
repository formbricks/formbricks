import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getConditionValueOptions } from "./utils";

const mockT = ((key: string) => key) as any;

const buildSurveyWithCta = (buttonExternal: boolean): TSurvey =>
  ({
    id: "survey-1",
    name: "Survey",
    blocks: [
      {
        id: "block-cta",
        name: "block-cta",
        elements: [
          {
            id: "cta-element",
            type: TSurveyElementTypeEnum.CTA,
            headline: { default: "CTA" },
            required: false,
            buttonLabel: { default: "Click" },
            buttonExternal,
            buttonUrl: "",
            dismissButtonLabel: { default: "Skip" },
          },
        ],
        logic: [],
      },
    ],
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
    endings: [],
  }) as unknown as TSurvey;

describe("getConditionValueOptions", () => {
  test("includes CTA elements when buttonExternal is enabled", () => {
    const survey = buildSurveyWithCta(true);
    const options = getConditionValueOptions(survey, mockT);

    const elementsGroup = options.find((group) => group.value === "elements");
    expect(elementsGroup).toBeDefined();
    expect(elementsGroup?.options.some((option) => option.value === "cta-element")).toBe(true);
  });

  test("includes CTA elements when buttonExternal is disabled (ENG-926 regression)", () => {
    const survey = buildSurveyWithCta(false);
    const options = getConditionValueOptions(survey, mockT);

    const elementsGroup = options.find((group) => group.value === "elements");
    expect(elementsGroup).toBeDefined();
    expect(elementsGroup?.options.some((option) => option.value === "cta-element")).toBe(true);
  });
});
