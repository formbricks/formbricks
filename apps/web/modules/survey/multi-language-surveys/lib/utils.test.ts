import { type TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import {
  computeTranslationProgress,
  extractTranslatableStrings,
  makeLanguageSoleDefault,
  removeAllTranslations,
  setTranslationAtPathMutable,
} from "./utils";

const t = ((key: string, options?: Record<string, unknown>) => {
  const translations: Record<string, string> = {
    "common.choice_n": `Choice ${options?.n}`,
    "common.headline": "Headline",
    "common.other_placeholder": "Other Placeholder",
    "workspace.surveys.edit.please_specify": "Please specify",
    "workspace.surveys.edit.lower_label": "Lower label",
    "workspace.surveys.edit.upper_label": "Upper label",
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

  test("extracts image alt text of elements, picture choices and endings, skipping empty ones", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "pic",
              type: TSurveyElementTypeEnum.PictureSelection,
              headline: { default: "Pick one" },
              required: true,
              allowMulti: false,
              imageUrl: "https://example.com/hero.jpg",
              imageAltText: { default: "Hero shot" },
              choices: [
                { id: "a", imageUrl: "https://example.com/a.jpg", imageAltText: { default: "Blue mug" } },
                { id: "b", imageUrl: "https://example.com/b.jpg", imageAltText: { default: "" } },
              ],
            },
          ],
        },
      ],
      endings: [
        {
          id: "end-1",
          type: "endScreen",
          headline: { default: "Thanks" },
          imageUrl: "https://example.com/thanks.jpg",
          imageAltText: { default: "Team waving" },
        },
      ],
    });

    const altPaths = extractTranslatableStrings(survey, t)
      .filter((s) => s.path.endsWith("imageAltText"))
      .map((s) => s.path);

    expect(altPaths).toEqual([
      "blocks.0.elements.0.imageAltText",
      "blocks.0.elements.0.choices.0.imageAltText",
      "endings.0.imageAltText",
    ]);
  });

  test("extracts the scale labels of csat and ces elements", () => {
    const survey = createSurvey({
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "csat",
              type: TSurveyElementTypeEnum.CSAT,
              headline: { default: "How satisfied are you?" },
              required: true,
              scale: "smiley",
              range: 5,
              lowerLabel: { default: "Not satisfied at all" },
              upperLabel: { default: "Very satisfied" },
            },
            {
              id: "ces",
              type: TSurveyElementTypeEnum.CES,
              headline: { default: "How easy was it?" },
              required: true,
              scale: "number",
              range: 5,
              lowerLabel: { default: "Very difficult" },
              upperLabel: { default: "Very easy" },
            },
          ],
        },
      ],
    });

    const strings = extractTranslatableStrings(survey, t);

    expect(strings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "blocks.0.elements.0.lowerLabel",
          fieldLabel: "Lower label",
          value: { default: "Not satisfied at all" },
        }),
        expect.objectContaining({
          path: "blocks.0.elements.0.upperLabel",
          fieldLabel: "Upper label",
          value: { default: "Very satisfied" },
        }),
        expect.objectContaining({
          path: "blocks.0.elements.1.lowerLabel",
          fieldLabel: "Lower label",
          value: { default: "Very difficult" },
        }),
        expect.objectContaining({
          path: "blocks.0.elements.1.upperLabel",
          fieldLabel: "Upper label",
          value: { default: "Very easy" },
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

  describe("changing the default language", () => {
    const language = (code: string) => ({
      id: `lang-${code}`,
      code,
      alias: null,
      workspaceId: "ws",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const multiLanguageSurvey = () =>
      createSurvey({
        languages: [
          { language: language("en"), default: true, enabled: true },
          { language: language("de"), default: false, enabled: true },
          { language: language("fr"), default: false, enabled: false },
        ],
        blocks: [
          {
            id: "b1",
            elements: [
              {
                id: "q1",
                type: TSurveyElementTypeEnum.OpenText,
                headline: { default: "Hello", de: "Hallo", fr: "Bonjour" },
              },
            ],
          },
        ],
      });

    test("removeAllTranslations strips every non-default language key and keeps the languages list", () => {
      const survey = multiLanguageSurvey();
      const result = removeAllTranslations(survey);

      expect(result.blocks[0].elements[0].headline).toEqual({ default: "Hello" });
      expect(result.languages).toEqual(survey.languages);
      // input is not mutated
      expect(survey.blocks[0].elements[0].headline).toEqual({ default: "Hello", de: "Hallo", fr: "Bonjour" });
    });

    test("removeAllTranslations also strips keys of languages no longer on the survey", () => {
      const survey = createSurvey({
        languages: [
          { language: language("en"), default: true, enabled: true },
          { language: language("de"), default: false, enabled: true },
        ],
        blocks: [
          {
            id: "b1",
            elements: [
              {
                id: "q1",
                type: TSurveyElementTypeEnum.OpenText,
                headline: { default: "Hello", de: "Hallo", es: "Hola" },
              },
            ],
          },
        ],
      });

      const result = removeAllTranslations(survey);

      expect(result.blocks[0].elements[0].headline).toEqual({ default: "Hello" });
      expect(result.languages).toEqual(survey.languages);
    });

    test("removeAllTranslations strips metadata title/description but keeps arbitrary metadata", () => {
      const survey = createSurvey({
        languages: [{ language: language("en"), default: true, enabled: true }],
        metadata: {
          title: { default: "Title", de: "Titel" },
          description: { default: "Desc", de: "Beschreibung" },
          arbitraryConfig: { default: "x", mode: "strict" },
        },
      });

      const result = removeAllTranslations(survey);

      expect(result.metadata).toEqual({
        title: { default: "Title" },
        description: { default: "Desc" },
        arbitraryConfig: { default: "x", mode: "strict" },
      });
    });

    test("makeLanguageSoleDefault removes all translations and leaves the language as sole default", () => {
      const de = language("de");
      const result = makeLanguageSoleDefault(multiLanguageSurvey(), de);

      expect(result.blocks[0].elements[0].headline).toEqual({ default: "Hello" });
      expect(result.languages).toEqual([{ language: de, default: true, enabled: true }]);
    });

    test("makeLanguageSoleDefault strips the promoted language's own key even when it is not on the survey", () => {
      const es = language("es");
      const survey = createSurvey({
        languages: [{ language: language("en"), default: true, enabled: true }],
        blocks: [
          {
            id: "b1",
            elements: [
              { id: "q1", type: TSurveyElementTypeEnum.OpenText, headline: { default: "Hello", es: "" } },
            ],
          },
        ],
      });

      const result = makeLanguageSoleDefault(survey, es);

      expect(result.blocks[0].elements[0].headline).toEqual({ default: "Hello" });
      expect(result.languages).toEqual([{ language: es, default: true, enabled: true }]);
    });
  });

  test("extracts every text of every element type, in survey order, with its path, label and owner", () => {
    // Echoes the key and its options, so a field's label is checked without a translation table.
    const keyT = ((key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;

    const strings = extractTranslatableStrings(EVERY_TEXT_SURVEY, keyT).map(
      ({ path, displayId, fieldLabel, elementId, isRichText }) => [
        path,
        displayId,
        fieldLabel,
        elementId,
        isRichText,
      ]
    );

    expect(strings).toEqual([
      ["welcomeCard.headline", "W", "common.headline", "start", true],
      ["welcomeCard.subheader", "W", "common.subheader", "start", true],
      ["welcomeCard.buttonLabel", "W", "workspace.surveys.edit.button_label", "start", false],
      ["blocks.0.buttonLabel", "1", "workspace.surveys.edit.button_label", "block-1", false],
      ["blocks.0.backButtonLabel", "1", "workspace.surveys.edit.back_button_label", "block-1", false],
      ["blocks.0.elements.0.headline", "1.1", "common.headline", "open", true],
      ["blocks.0.elements.0.subheader", "1.1", "common.subheader", "open", true],
      ["blocks.0.elements.0.imageAltText", "1.1", "workspace.surveys.edit.image_alt_text", "open", false],
      ["blocks.0.elements.0.placeholder", "1.1", "common.placeholder", "open", false],
      ["blocks.0.elements.1.headline", "1.2", "common.headline", "single", true],
      ["blocks.0.elements.1.choices.0.label", "1.2", 'common.choice_n {"n":1}', "single", false],
      ["blocks.0.elements.1.choices.1.label", "1.2", 'common.choice_n {"n":2}', "single", false],
      ["blocks.0.elements.1.choices.2.label", "1.2", 'common.choice_n {"n":3}', "single", false],
      ["blocks.0.elements.1.otherOptionPlaceholder", "1.2", "common.other_placeholder", "single", false],
      ["blocks.1.elements.0.headline", "2.1", "common.headline", "multi", true],
      ["blocks.1.elements.0.choices.0.label", "2.1", 'common.choice_n {"n":1}', "multi", false],
      ["blocks.1.elements.0.choices.1.label", "2.1", 'common.choice_n {"n":2}', "multi", false],
      ["blocks.1.elements.1.headline", "2.2", "common.headline", "nps", true],
      ["blocks.1.elements.1.lowerLabel", "2.2", "workspace.surveys.edit.lower_label", "nps", false],
      ["blocks.1.elements.1.upperLabel", "2.2", "workspace.surveys.edit.upper_label", "nps", false],
      ["blocks.1.elements.2.headline", "2.3", "common.headline", "cta", true],
      ["blocks.1.elements.2.ctaButtonLabel", "2.3", "workspace.surveys.edit.cta_button_label", "cta", false],
      ["blocks.1.elements.3.headline", "2.4", "common.headline", "rating", true],
      ["blocks.1.elements.3.lowerLabel", "2.4", "workspace.surveys.edit.lower_label", "rating", false],
      ["blocks.1.elements.3.upperLabel", "2.4", "workspace.surveys.edit.upper_label", "rating", false],
      ["blocks.1.elements.4.headline", "2.5", "common.headline", "consent", true],
      ["blocks.1.elements.4.label", "2.5", "common.label", "consent", false],
      ["blocks.1.elements.5.headline", "2.6", "common.headline", "pictures", true],
      [
        "blocks.1.elements.5.choices.0.imageAltText",
        "2.6",
        'workspace.surveys.edit.image_alt_text_choice_n {"n":1}',
        "pictures",
        false,
      ],
      ["blocks.1.elements.6.headline", "2.7", "common.headline", "date", true],
      ["blocks.1.elements.6.html", "2.7", "common.html", "date", true],
      ["blocks.1.elements.7.headline", "2.8", "common.headline", "matrix", true],
      ["blocks.1.elements.7.rows.0.label", "2.8", 'common.row_n {"n":1}', "matrix", false],
      ["blocks.1.elements.7.rows.1.label", "2.8", 'common.row_n {"n":2}', "matrix", false],
      ["blocks.1.elements.7.columns.0.label", "2.8", 'common.column_n {"n":1}', "matrix", false],
      ["blocks.1.elements.7.columns.1.label", "2.8", 'common.column_n {"n":2}', "matrix", false],
      ["blocks.1.elements.8.headline", "2.9", "common.headline", "address", true],
      [
        "blocks.1.elements.8.addressLine1.placeholder",
        "2.9",
        'common.field_placeholder {"field":"addressLine1"}',
        "address",
        false,
      ],
      [
        "blocks.1.elements.8.city.placeholder",
        "2.9",
        'common.field_placeholder {"field":"city"}',
        "address",
        false,
      ],
      [
        "blocks.1.elements.8.state.placeholder",
        "2.9",
        'common.field_placeholder {"field":"state"}',
        "address",
        false,
      ],
      [
        "blocks.1.elements.8.zip.placeholder",
        "2.9",
        'common.field_placeholder {"field":"zip"}',
        "address",
        false,
      ],
      [
        "blocks.1.elements.8.country.placeholder",
        "2.9",
        'common.field_placeholder {"field":"country"}',
        "address",
        false,
      ],
      ["blocks.1.elements.9.headline", "2.10", "common.headline", "ranking", true],
      ["blocks.1.elements.9.choices.0.label", "2.10", 'common.choice_n {"n":1}', "ranking", false],
      ["blocks.1.elements.9.choices.1.label", "2.10", 'common.choice_n {"n":2}', "ranking", false],
      ["blocks.1.elements.10.headline", "2.11", "common.headline", "contact", true],
      [
        "blocks.1.elements.10.firstName.placeholder",
        "2.11",
        'common.field_placeholder {"field":"firstName"}',
        "contact",
        false,
      ],
      [
        "blocks.1.elements.10.lastName.placeholder",
        "2.11",
        'common.field_placeholder {"field":"lastName"}',
        "contact",
        false,
      ],
      [
        "blocks.1.elements.10.email.placeholder",
        "2.11",
        'common.field_placeholder {"field":"email"}',
        "contact",
        false,
      ],
      [
        "blocks.1.elements.10.phone.placeholder",
        "2.11",
        'common.field_placeholder {"field":"phone"}',
        "contact",
        false,
      ],
      [
        "blocks.1.elements.10.company.placeholder",
        "2.11",
        'common.field_placeholder {"field":"company"}',
        "contact",
        false,
      ],
      ["blocks.1.elements.11.headline", "2.12", "common.headline", "csat", true],
      ["blocks.1.elements.11.lowerLabel", "2.12", "workspace.surveys.edit.lower_label", "csat", false],
      ["blocks.1.elements.11.upperLabel", "2.12", "workspace.surveys.edit.upper_label", "csat", false],
      ["blocks.1.elements.12.headline", "2.13", "common.headline", "files", true],
      ["endings.0.headline", "E1", "common.headline", "ending-thanks", true],
      ["endings.0.subheader", "E1", "common.subheader", "ending-thanks", true],
      ["endings.0.imageAltText", "E1", "workspace.surveys.edit.image_alt_text", "ending-thanks", false],
      ["endings.0.buttonLabel", "E1", "workspace.surveys.edit.button_label", "ending-thanks", false],
    ]);
  });
});
