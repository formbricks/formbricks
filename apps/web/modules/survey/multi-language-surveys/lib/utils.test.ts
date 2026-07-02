import { type TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { computeTranslationProgress, extractTranslatableStrings, setTranslationAtPathMutable } from "./utils";

const t = ((key: string, options?: Record<string, unknown>) => {
  const translations: Record<string, string> = {
    "common.choice_n": `Choice ${options?.n}`,
    "common.headline": "Headline",
    "common.other_placeholder": "Other Placeholder",
    "workspace.surveys.edit.please_specify": "Please specify",
  };

  return translations[key] ?? key;
}) as unknown as TFunction;

const createSurvey = (survey: Record<string, unknown>): TSurvey =>
  ({
    welcomeCard: { enabled: false },
    blocks: [],
    endings: [],
    metadata: {},
    ...survey,
  }) as unknown as TSurvey;

describe("multi-language survey utils", () => {
  test("extracts missing other option placeholders for single and multi select elements", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "single",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Pick one" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
                { id: "other", label: { default: "Other" } },
              ],
            },
            {
              id: "multi",
              type: TSurveyElementTypeEnum.MultipleChoiceMulti,
              headline: { default: "Pick many" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
                { id: "other", label: { default: "Other" } },
              ],
            },
          ],
        },
      ],
    });

    const strings = extractTranslatableStrings(survey, t);

    expect(strings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "blocks.0.elements.0.otherOptionPlaceholder",
          fieldLabel: "Other Placeholder",
          value: { default: "Please specify" },
        }),
        expect.objectContaining({
          path: "blocks.0.elements.1.otherOptionPlaceholder",
          fieldLabel: "Other Placeholder",
          value: { default: "Please specify" },
        }),
      ])
    );
  });

  test("extracts a missing other option placeholder for ranking elements", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "ranking",
              type: TSurveyElementTypeEnum.Ranking,
              headline: { default: "Rank these" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
                { id: "other", label: { default: "Other" } },
              ],
            },
          ],
        },
      ],
    });

    const strings = extractTranslatableStrings(survey, t);

    expect(strings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "blocks.0.elements.0.otherOptionPlaceholder",
          fieldLabel: "Other Placeholder",
          value: { default: "Please specify" },
        }),
      ])
    );
  });

  test("keeps existing other option placeholder translations when default text is empty", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "single",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Pick one" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
                { id: "other", label: { default: "Other" } },
              ],
              otherOptionPlaceholder: { default: "", de: "Bitte angeben" },
            },
          ],
        },
      ],
    });

    const placeholder = extractTranslatableStrings(survey, t).find(
      (string) => string.path === "blocks.0.elements.0.otherOptionPlaceholder"
    );

    expect(placeholder?.value).toEqual({ default: "Please specify", de: "Bitte angeben" });
    expect(computeTranslationProgress([placeholder!], "de")).toEqual({
      translated: 1,
      total: 1,
      percentage: 100,
    });
  });

  test("does not extract stale other option placeholders without an other choice", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "single",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Pick one" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
              ],
              otherOptionPlaceholder: { default: "Please specify" },
            },
          ],
        },
      ],
    });

    expect(
      extractTranslatableStrings(survey, t).some(
        (string) => string.path === "blocks.0.elements.0.otherOptionPlaceholder"
      )
    ).toBe(false);
  });

  test("creates a missing translatable field when saving a translation with a default value", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "single",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Pick one" },
              required: true,
              choices: [
                { id: "choice-1", label: { default: "One" } },
                { id: "choice-2", label: { default: "Two" } },
                { id: "other", label: { default: "Other" } },
              ],
            },
          ],
        },
      ],
    });

    setTranslationAtPathMutable(
      survey,
      "blocks.0.elements.0.otherOptionPlaceholder",
      "de",
      "Bitte angeben",
      "Please specify"
    );

    expect(survey.blocks[0].elements[0]).toMatchObject({
      otherOptionPlaceholder: { default: "Please specify", de: "Bitte angeben" },
    });
  });
});
