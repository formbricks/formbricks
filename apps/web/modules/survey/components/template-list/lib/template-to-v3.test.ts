import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { CUSTOM_SURVEY_TEMPLATE_ID, customSurveyTemplate, templates } from "@/app/lib/templates";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import { buildV3SurveyCreatePayloadFromTemplate } from "./template-to-v3";

const workspaceId = "clxx1234567890123456789012";
const workspace = {
  id: workspaceId,
  name: "Acme",
};
const t = ((key: string) => key) as TFunction;

const unsupportedRootFields = [
  "questions",
  "styling",
  "triggers",
  "recaptcha",
  "followUps",
  "recontactDays",
  "displayOption",
  "autoClose",
  "singleUse",
  "pin",
];

const makeInternalI18nString = (value: string) => ({ default: value });
const blockOneId = "clbk1234567890123456789012";
const blockTwoId = "clbk2234567890123456789012";
const endingOneId = "clend123456789012345678901";
const endingTwoId = "clend223456789012345678901";
const variableId = "clvar123456789012345678901";

const toggleField = (placeholder: string, required = false) => ({
  show: true,
  required,
  placeholder: makeInternalI18nString(placeholder),
});

const fixtureTemplate = {
  id: "fixture-template",
  name: "Fixture Template",
  description: "Fixture description",
  preset: {
    name: "Fixture survey",
    questions: [],
    styling: {},
    triggers: [],
    recaptcha: { enabled: true },
    followUps: [],
    recontactDays: 7,
    metadata: {
      title: makeInternalI18nString("Fixture title"),
      description: makeInternalI18nString("Fixture description"),
      nonTranslatable: "kept as-is",
    },
    welcomeCard: {
      enabled: true,
      headline: makeInternalI18nString("Welcome"),
      subheader: makeInternalI18nString("Intro"),
      buttonLabel: makeInternalI18nString("Start"),
      timeToFinish: false,
      showResponseCount: false,
    },
    blocks: [
      {
        id: blockOneId,
        name: "Block One",
        buttonLabel: makeInternalI18nString("Next"),
        backButtonLabel: makeInternalI18nString("Back"),
        elements: [
          {
            id: "open_text",
            type: "openText",
            headline: makeInternalI18nString("Open text headline"),
            placeholder: makeInternalI18nString("Open text placeholder"),
            required: true,
            inputType: "text",
          },
          {
            id: "choice",
            type: "multipleChoiceSingle",
            headline: makeInternalI18nString("Pick one"),
            required: true,
            choices: [
              { id: "choice_a", label: makeInternalI18nString("Choice A") },
              { id: "choice_b", label: makeInternalI18nString("Choice B") },
            ],
          },
          {
            id: "matrix",
            type: "matrix",
            headline: makeInternalI18nString("Matrix"),
            required: true,
            rows: [{ id: "row_a", label: makeInternalI18nString("Row A") }],
            columns: [{ id: "column_a", label: makeInternalI18nString("Column A") }],
          },
          {
            id: "contact",
            type: "contactInfo",
            headline: makeInternalI18nString("Contact"),
            required: true,
            firstName: toggleField("First name placeholder"),
            lastName: toggleField("Last name placeholder"),
            email: toggleField("Email placeholder", true),
            phone: toggleField("Phone placeholder"),
            company: toggleField("Company placeholder"),
          },
          {
            id: "cta",
            type: "cta",
            headline: makeInternalI18nString("CTA"),
            required: false,
            buttonExternal: true,
            buttonUrl: "https://example.com/demo",
            ctaButtonLabel: makeInternalI18nString("Open demo"),
          },
        ],
        logic: [
          {
            id: "cllog123456789012345678901",
            conditions: {
              id: "clgrp123456789012345678901",
              connector: "and",
              conditions: [
                {
                  id: "clcon123456789012345678901",
                  leftOperand: { type: "element", value: "open_text" },
                  operator: "isSubmitted",
                },
              ],
            },
            actions: [
              {
                id: "clact123456789012345678901",
                objective: "jumpToBlock",
                target: blockTwoId,
              },
            ],
          },
        ],
      },
      {
        id: blockTwoId,
        name: "Block Two",
        elements: [
          {
            id: "final_feedback",
            type: "openText",
            headline: makeInternalI18nString("Final feedback"),
            required: false,
            inputType: "text",
          },
        ],
      },
    ],
    endings: [
      {
        id: endingOneId,
        type: "endScreen",
        headline: makeInternalI18nString("Thanks"),
        subheader: makeInternalI18nString("Done"),
        buttonLabel: makeInternalI18nString("Visit"),
        buttonLink: "https://example.com/thanks",
      },
      {
        id: endingTwoId,
        type: "redirectToUrl",
        url: "https://example.com/next",
        label: "Next",
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["utm_source"],
    },
    variables: [
      {
        id: variableId,
        name: "score",
        type: "number",
        value: 0,
      },
    ],
  },
} as const;

describe("buildV3SurveyCreatePayloadFromTemplate", () => {
  test.each(["en-US", "de-DE", "pt-PT", "zh-Hans-CN"] as const)(
    "converts internal default i18n strings to %s public locale maps",
    (defaultLanguage) => {
      const payload = buildV3SurveyCreatePayloadFromTemplate({
        template: fixtureTemplate as any,
        workspaceId,
        surveyType: "link",
        defaultLanguage,
      }) as any;

      expect(payload.welcomeCard.headline).toEqual({ [defaultLanguage]: "Welcome" });
      expect(payload.welcomeCard.buttonLabel).toEqual({ [defaultLanguage]: "Start" });
      expect(payload.blocks[0].buttonLabel).toEqual({ [defaultLanguage]: "Next" });
      expect(payload.blocks[0].elements[0].placeholder).toEqual({
        [defaultLanguage]: "Open text placeholder",
      });
      expect(payload.blocks[0].elements[1].choices[0].label).toEqual({
        [defaultLanguage]: "Choice A",
      });
      expect(payload.blocks[0].elements[2].rows[0].label).toEqual({ [defaultLanguage]: "Row A" });
      expect(payload.blocks[0].elements[2].columns[0].label).toEqual({
        [defaultLanguage]: "Column A",
      });
      expect(payload.blocks[0].elements[3].email.placeholder).toEqual({
        [defaultLanguage]: "Email placeholder",
      });
      expect(payload.blocks[0].elements[4].ctaButtonLabel).toEqual({
        [defaultLanguage]: "Open demo",
      });
      expect(payload.endings[0].headline).toEqual({ [defaultLanguage]: "Thanks" });
      expect(payload.metadata.title).toEqual({ [defaultLanguage]: "Fixture title" });
    }
  );

  test("outputs only v3-supported root fields and preserves identifiers, logic, hidden fields, and variables", () => {
    const payload = buildV3SurveyCreatePayloadFromTemplate({
      template: fixtureTemplate as any,
      workspaceId,
      surveyType: "app",
      defaultLanguage: "en-US",
    }) as any;

    expect(Object.keys(payload).sort()).toEqual(
      [
        "blocks",
        "defaultLanguage",
        "endings",
        "hiddenFields",
        "languages",
        "metadata",
        "name",
        "status",
        "type",
        "variables",
        "welcomeCard",
        "workspaceId",
      ].sort()
    );
    for (const field of unsupportedRootFields) {
      expect(payload).not.toHaveProperty(field);
    }

    expect(payload).toMatchObject({
      workspaceId,
      name: "Fixture survey",
      type: "app",
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
      variables: [{ id: variableId, name: "score", type: "number", value: 0 }],
      blocks: [
        expect.objectContaining({
          id: blockOneId,
          logic: [
            expect.objectContaining({
              actions: [expect.objectContaining({ objective: "jumpToBlock", target: blockTwoId })],
            }),
          ],
        }),
        expect.objectContaining({ id: blockTwoId }),
      ],
      endings: [
        expect.objectContaining({ id: endingOneId, buttonLink: "https://example.com/thanks" }),
        expect.objectContaining({ id: endingTwoId, url: "https://example.com/next" }),
      ],
    });
    const preparation = prepareV3SurveyCreateInput(payload);
    expect(
      preparation,
      preparation.ok ? undefined : JSON.stringify(preparation.validation.invalidParams)
    ).toMatchObject({
      ok: true,
    });
  });

  test("builds valid v3 create payloads for every trusted template", () => {
    const catalog = [customSurveyTemplate(t), ...templates(t)];

    for (const template of catalog) {
      const templateWithPlaceholders = replacePresetPlaceholders(template, workspace);
      const payload = buildV3SurveyCreatePayloadFromTemplate({
        template: templateWithPlaceholders,
        workspaceId,
        surveyType: template.id === CUSTOM_SURVEY_TEMPLATE_ID ? "link" : "app",
        defaultLanguage: "en-US",
      });
      const preparation = prepareV3SurveyCreateInput(payload);

      expect(preparation, template.id).toMatchObject({ ok: true });
    }
  });
});
