import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { ZSurveyExportEnvelope } from "@/app/api/v3/surveys/export/schemas";
import { ZV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_BLOCK_1_ID,
  FIXTURE_CODE_ACTION_CLASS,
  FIXTURE_EMPTY_SURVEY,
  FIXTURE_LEGACY_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_NOCODE_ACTION_CLASS,
  FIXTURE_SURVEY_ID,
  FIXTURE_WORKSPACE_ID,
} from "./__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "./build-export-envelope";

const ctx = {
  appVersion: "6.2.0",
  publicUrl: "https://app.formbricks.com",
  exportedAt: new Date("2026-09-08T12:00:00.000Z"),
};

const ALL_ELEMENT_TYPES = [
  "openText",
  "nps",
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "consent",
  "cta",
  "rating",
  "csat",
  "ces",
  "matrix",
  "ranking",
  "pictureSelection",
  "date",
  "fileUpload",
  "cal",
  "address",
  "contactInfo",
];

function expectOk<T, E>(result: { ok: true; data: T } | { ok: false; error: E }): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got ${JSON.stringify(result.error, null, 2)}`);
  }
  return result.data;
}

describe("buildSurveyExportEnvelope", () => {
  test("exports a fully featured link survey as a three-key envelope in export format 1", () => {
    const envelope = expectOk(buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, ctx));

    expect(Object.keys(envelope)).toEqual(["formbricks", "survey", "references"]);
    expect(envelope.formbricks).toEqual({
      exportFormat: 1,
      exportedAt: "2026-09-08T12:00:00.000Z",
      appVersion: "6.2.0",
      source: {
        url: "https://app.formbricks.com",
        workspaceId: FIXTURE_WORKSPACE_ID,
        surveyId: FIXTURE_SURVEY_ID,
      },
    });
    expect(envelope.references.actionClasses).toEqual([]);

    const { survey } = envelope;
    expect(survey.type).toBe("link");
    expect(survey.defaultLanguage).toBe("en-US");
    expect(survey.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(survey.blocks.flatMap((block) => block.elements.map((element) => element.type)).sort()).toEqual(
      [...ALL_ELEMENT_TYPES].sort()
    );
    // Public locale maps, not the internal `default` key.
    expect(survey.blocks[0].elements[0].headline).toEqual({
      "en-US": "What should we improve?",
      "de-DE": "Was sollen wir verbessern?",
    });
    expect(survey.endings[0]).toMatchObject({
      type: "endScreen",
      headline: { "en-US": "Thanks, #recall:q_open/fallback:#!" },
    });
    expect(survey.hiddenFields).toEqual({ enabled: true, fieldIds: ["utm_source", "plan"] });
    expect(survey.variables).toHaveLength(1);
  });

  test("never reads styling, follow-ups, settings, slug, scripts, schedule or instance fields", () => {
    const envelope = expectOk(buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, ctx));
    const serialized = JSON.stringify(envelope);

    for (const forbidden of [
      "styling",
      "followUps",
      "singleUse",
      "pin",
      "recaptcha",
      "surveyClosedMessage",
      "showLanguageSwitch",
      "isVerifyEmailEnabled",
      "isBackButtonHidden",
      "slug",
      "customHeadScripts",
      "publishOn",
      "closeOn",
      "createdBy",
      "createdAt",
      "updatedAt",
      "archivedAt",
      "workspaceOverwrites",
      "segment",
      "targeting",
      "alert(1)",
      "product-feedback",
    ]) {
      expect(serialized, forbidden).not.toContain(`"${forbidden}"`);
    }
    expect(envelope.survey).not.toHaveProperty("id");
    expect(envelope.survey).not.toHaveProperty("workspaceId");
    expect(envelope.survey).not.toHaveProperty("distribution");
  });

  test("round-trips through the v3 create schema and the envelope schema", () => {
    const envelope = expectOk(buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, ctx));

    const createBody = ZV3CreateSurveyBody.safeParse({
      workspaceId: FIXTURE_WORKSPACE_ID,
      ...envelope.survey,
    });
    expect(createBody.success, JSON.stringify(createBody.error?.issues)).toBe(true);

    const parsedEnvelope = ZSurveyExportEnvelope.safeParse(JSON.parse(JSON.stringify(envelope)));
    expect(parsedEnvelope.success, JSON.stringify(parsedEnvelope.error?.issues)).toBe(true);
  });

  test("is deterministic apart from exportedAt", () => {
    const first = expectOk(buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, ctx));
    const second = expectOk(buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, ctx));

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("carries triggers and action-class definitions for app surveys, but no targeting", () => {
    const envelope = expectOk(buildSurveyExportEnvelope(FIXTURE_APP_SURVEY, ctx));

    expect(envelope.survey.type).toBe("app");
    expect(envelope.survey.distribution).toMatchObject({
      displayOption: "respondMultiple",
      recontactDays: 7,
      delay: 5,
      triggers: [
        { actionClassId: FIXTURE_CODE_ACTION_CLASS.id },
        { actionClassId: FIXTURE_NOCODE_ACTION_CLASS.id },
      ],
    });
    expect(envelope.survey).not.toHaveProperty("targeting");
    expect(envelope.references.actionClasses).toEqual([
      {
        id: FIXTURE_CODE_ACTION_CLASS.id,
        name: "Checkout Complete",
        key: "checkout_complete",
        type: "code",
        noCodeConfig: null,
        description: "Fired after checkout",
      },
      {
        id: FIXTURE_NOCODE_ACTION_CLASS.id,
        name: "Clicked pricing",
        key: null,
        type: "noCode",
        noCodeConfig: FIXTURE_NOCODE_ACTION_CLASS.noCodeConfig,
        description: null,
      },
    ]);
    expect(JSON.stringify(envelope)).not.toContain("contactAttributeKey");

    const createBody = ZV3CreateSurveyBody.safeParse({
      workspaceId: FIXTURE_WORKSPACE_ID,
      ...envelope.survey,
    });
    expect(createBody.success, JSON.stringify(createBody.error?.issues)).toBe(true);
  });

  test("de-duplicates action classes referenced by more than one trigger", () => {
    const survey = {
      ...FIXTURE_APP_SURVEY,
      triggers: [{ actionClass: FIXTURE_CODE_ACTION_CLASS }, { actionClass: FIXTURE_CODE_ACTION_CLASS }],
    } as unknown as TSurvey;

    const envelope = expectOk(buildSurveyExportEnvelope(survey, ctx));

    expect(envelope.survey.distribution?.triggers).toHaveLength(2);
    expect(envelope.references.actionClasses).toHaveLength(1);
  });

  test("converts legacy question-based surveys to blocks", () => {
    const envelope = expectOk(buildSurveyExportEnvelope(FIXTURE_LEGACY_SURVEY, ctx));

    expect(envelope.survey.blocks).toHaveLength(1);
    expect(envelope.survey.blocks[0].elements[0]).toMatchObject({ id: "legacy_open", type: "openText" });
    expect(envelope.survey).not.toHaveProperty("questions");
  });

  test("refuses empty surveys", () => {
    const result = buildSurveyExportEnvelope(FIXTURE_EMPTY_SURVEY, ctx);

    expect(result).toEqual({
      ok: false,
      error: [{ name: "survey.blocks", reason: expect.stringContaining("Empty surveys cannot be exported") }],
    });
  });

  test("refuses a survey with a dangling jumpToBlock target with the v3 path format", () => {
    const survey = {
      ...FIXTURE_LINK_SURVEY,
      blocks: FIXTURE_LINK_SURVEY.blocks.map((block) =>
        block.id === FIXTURE_BLOCK_1_ID
          ? {
              ...block,
              logic: block.logic?.map((logic) => ({
                ...logic,
                actions: [{ ...logic.actions[0], target: "clbkmissing000000000000001" }],
              })),
            }
          : block
      ),
    } as unknown as TSurvey;

    const result = buildSurveyExportEnvelope(survey, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual([
        expect.objectContaining({
          name: "blocks.0.logic.0.actions.0.target",
          code: "dangling_reference",
          missingId: "clbkmissing000000000000001",
        }),
      ]);
    }
  });

  test("fills a translation missing on a draft from the default language so the file re-imports", () => {
    const survey = {
      ...FIXTURE_LINK_SURVEY,
      blocks: [
        {
          id: FIXTURE_BLOCK_1_ID,
          name: "Only block",
          elements: [
            {
              id: "q_incomplete",
              type: "openText",
              headline: { default: "English only" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      endings: [],
      metadata: {},
      welcomeCard: { enabled: false },
      hiddenFields: { enabled: false },
      variables: [],
    } as unknown as TSurvey;

    const envelope = expectOk(buildSurveyExportEnvelope(survey, ctx));

    expect(envelope.survey.blocks[0].elements[0].headline).toEqual({
      "en-US": "English only",
      "de-DE": "English only",
    });
  });
});
