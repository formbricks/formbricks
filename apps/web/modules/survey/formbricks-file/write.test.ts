import { describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { ZFormbricksFileV1 } from "./envelope";
import { getFormbricksFileAttributeKeys, writeFormbricksFile } from "./write";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://surveys.example.com" }));

// `WEBAPP_URL` is "https://test-webapp-url.com" in every unit test (vitestSetup.ts).
const WEBAPP_URL = "https://test-webapp-url.com";

const VISIBILITY = {
  actorContext: { enforced: false, isOrganizationAdmin: false, kind: "user", userId: "user_1" },
  gates: { entitled: false, ready: false },
  ownerName: "Owner",
} as const;

const SURVEY_ID = "clsurvey0000000000000001";
const WORKSPACE_ID = "clworkspace0000000000001";
const BLOCK_ID = "clblock00000000000000001";
const ENDING_ID = "clending0000000000000001";
const ACTION_CLASS = {
  id: "claction0000000000000001",
  name: "Checkout",
  description: "Checkout completed",
  type: "code",
  key: "checkout",
  noCodeConfig: null,
  workspaceId: WORKSPACE_ID,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const language = (code: string, alias: string | null, isDefault: boolean) => ({
  default: isDefault,
  enabled: true,
  language: { id: `lang_${code}`, code, alias, createdAt: new Date(), updatedAt: new Date() },
});

const buildSurvey = (overrides: Record<string, unknown> = {}): TSurvey =>
  ({
    id: SURVEY_ID,
    workspaceId: WORKSPACE_ID,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-29T11:30:00.000Z"),
    name: "Onboarding NPS",
    type: "link",
    status: "draft",
    archivedAt: null,
    ownerId: "user_1",
    visibility: "workspace",
    visibilityVersion: 0,
    visibilityProjectedVersion: 0,
    metadata: {},
    languages: [language("en-US", null, true), language("de-DE", "de", false)],
    questions: [],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome", "de-DE": "Willkommen" },
      fileUrl: `/storage/${WORKSPACE_ID}/public/logo.png`,
    },
    blocks: [
      {
        id: BLOCK_ID,
        name: "Block 1",
        elements: [
          {
            id: "favorite",
            type: "multipleChoiceSingle",
            // No German headline: the export fills it from the default language.
            headline: { default: "Which one?" },
            required: true,
            imageUrl: `/storage/${WORKSPACE_ID}/private/diagram.png`,
            choices: [
              { id: "choice_a", label: { default: "A", "de-DE": "A" } },
              { id: "choice_b", label: { default: "B", "de-DE": "B" } },
            ],
          },
          {
            id: "picture",
            type: "pictureSelection",
            headline: { default: "Pick one", "de-DE": "Wähle eins" },
            required: false,
            allowMulti: false,
            choices: [
              { id: "pic_a", imageUrl: `/storage/${WORKSPACE_ID}/public/a.png` },
              { id: "pic_b", imageUrl: "https://cdn.example.org/b.png" },
            ],
          },
        ],
      },
    ],
    endings: [
      {
        id: ENDING_ID,
        type: "endScreen",
        headline: { default: "Thanks", "de-DE": "Danke" },
      },
    ],
    hiddenFields: { enabled: true, fieldIds: ["plan", "referrer"] },
    variables: [],
    embeddedFields: [
      {
        field: {
          id: "clembedded00000000000001",
          key: "plan",
          name: "Plan",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "plan" },
      },
      {
        field: {
          key: null,
          name: "referrer",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "referrer" },
      },
    ],
    triggers: [],
    segment: null,
    customCss: null,
    showLanguageSwitch: null,
    autoSelectLanguage: null,
    ...overrides,
  }) as unknown as TSurvey;

const appSurvey = (): TSurvey =>
  buildSurvey({
    type: "app",
    displayOption: "displayOnce",
    displayPercentage: null,
    displayLimit: null,
    recontactDays: null,
    autoClose: null,
    autoComplete: null,
    delay: 0,
    showConditions: null,
    triggers: [{ actionClass: ACTION_CLASS }],
    segment: {
      id: "clsegment000000000000001",
      filters: [
        {
          id: "f1",
          connector: null,
          resource: {
            id: "r1",
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "pro",
          },
        },
      ],
    },
  });

const write = (
  survey: TSurvey,
  attributeKeys: Parameters<typeof writeFormbricksFile>[0]["attributeKeys"] = []
) =>
  writeFormbricksFile({
    survey,
    visibility: VISIBILITY,
    attributeKeys,
    appVersion: "6.2.0",
    exportedAt: new Date("2026-10-30T12:00:00.000Z"),
  });

describe("writeFormbricksFile", () => {
  test("wraps the survey in the format 1 envelope, naming its source but not the instance it came from", () => {
    const file = write(buildSurvey());

    expect(file.$schema).toBe("https://formbricks.com/docs/schemas/formbricks-file/v1.json");
    expect(file.formbricks).toEqual({
      format: 1,
      exportedAt: "2026-10-30T12:00:00.000Z",
      appVersion: "6.2.0",
      source: { surveyId: SURVEY_ID, workspaceId: WORKSPACE_ID, updatedAt: "2026-10-29T11:30:00.000Z" },
    });
    expect(ZFormbricksFileV1.safeParse(file).error?.issues).toBeUndefined();
  });

  test("writes the survey as a v3 create body: no server-owned fields, ids kept, every language filled", () => {
    const { survey } = write(buildSurvey());

    for (const serverOwned of [
      "id",
      "workspaceId",
      "createdAt",
      "updatedAt",
      "archivedAt",
      "visibility",
      "owner",
      "access",
    ]) {
      expect(survey).not.toHaveProperty(serverOwned);
    }
    expect(survey).toMatchObject({ name: "Onboarding NPS", type: "link", status: "draft" });
    expect(survey.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(survey.blocks).toMatchObject([
      {
        id: BLOCK_ID,
        elements: [
          {
            id: "favorite",
            headline: { "en-US": "Which one?", "de-DE": "Which one?" },
            choices: [{ id: "choice_a" }, { id: "choice_b" }],
          },
          { id: "picture", choices: [{ id: "pic_a" }, { id: "pic_b" }] },
        ],
      },
    ]);
    expect(survey.endings).toMatchObject([{ id: ENDING_ID }]);
  });

  test("writes /storage media paths as absolute URLs, private ones against the app URL", () => {
    const { survey } = write(buildSurvey());

    expect(survey.welcomeCard).toMatchObject({
      fileUrl: `https://surveys.example.com/storage/${WORKSPACE_ID}/public/logo.png`,
    });
    expect(survey.blocks).toMatchObject([
      {
        elements: [
          { imageUrl: `${WEBAPP_URL}/storage/${WORKSPACE_ID}/private/diagram.png` },
          {
            choices: [
              { imageUrl: `https://surveys.example.com/storage/${WORKSPACE_ID}/public/a.png` },
              { imageUrl: "https://cdn.example.org/b.png" },
            ],
          },
        ],
      },
    ]);
  });

  test("embeds the shared embedded-data fields the survey links, but not its local ones", () => {
    expect(write(buildSurvey()).references.embeddedFields).toEqual([
      {
        storageKey: "plan",
        key: "plan",
        name: "Plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        locked: false,
      },
    ]);
  });

  test("embeds the action classes an app survey's triggers use, and the attribute keys its targeting names", () => {
    const planKey = { key: "plan", name: "Plan", description: "Billing plan", dataType: "string" } as const;
    const file = write(appSurvey(), [planKey]);

    expect(file.survey).toMatchObject({
      distribution: { triggers: [{ actionClassId: ACTION_CLASS.id }] },
      targeting: { filters: [{ resource: { root: { contactAttributeKey: "plan" } } }] },
    });
    expect(file.references.actionClasses).toEqual([
      {
        id: ACTION_CLASS.id,
        name: "Checkout",
        description: "Checkout completed",
        type: "code",
        key: "checkout",
        noCodeConfig: null,
      },
    ]);
    expect(file.references.attributeKeys).toEqual([planKey]);
    expect(ZFormbricksFileV1.safeParse(file).error?.issues).toBeUndefined();
  });

  test("carries each language's workspace alias in references, since the create body refuses one in the survey", () => {
    const file = write(buildSurvey());

    expect(file.references.languages).toEqual([{ code: "de-DE", alias: "de" }]);
    expect(file.survey.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(ZFormbricksFileV1.safeParse(file).error?.issues).toBeUndefined();
  });

  test("embeds no action classes for a link survey, whose triggers are not part of the file", () => {
    const linkSurveyWithStaleTriggers = buildSurvey({ triggers: [{ actionClass: ACTION_CLASS }] });
    expect(write(linkSurveyWithStaleTriggers).references.actionClasses).toEqual([]);
  });
});

describe("getFormbricksFileAttributeKeys", () => {
  test("names the attribute keys an app survey's targeting uses, and none for a link survey", () => {
    expect(getFormbricksFileAttributeKeys(appSurvey())).toEqual(["plan"]);
    expect(getFormbricksFileAttributeKeys(buildSurvey())).toEqual([]);
  });
});
