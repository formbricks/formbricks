import { describe, expect, test } from "vitest";
import { buildOutline, buildSettingLines, describeShowConditions } from "./outline";
import type { PreviewSettings, SurveyDocument } from "./types";

const survey: SurveyDocument = {
  id: "clsurvey1",
  name: "Feedback",
  type: "link",
  status: "inProgress",
  defaultLanguage: "en-US",
  languages: [
    { code: "en-US", default: true, enabled: true },
    { code: "de-DE", default: false, enabled: true },
  ],
  showLanguageSwitch: true,
  welcomeCard: { enabled: true, headline: { "en-US": "<b>Hello</b>" } },
  blocks: [
    {
      id: "b1",
      name: "First",
      elements: [
        {
          id: "q1",
          type: "multipleChoiceSingle",
          headline: { "en-US": "Pick one", "de-DE": "Wähle eins" },
          required: true,
          choices: [
            { id: "c1", label: { "en-US": "A", "de-DE": "A-de" } },
            { id: "c2", label: { "en-US": "B" } },
          ],
        },
        {
          id: "q2",
          type: "rating",
          headline: { "en-US": "Rate" },
          required: false,
          scale: "star",
          range: 5,
          lowerLabel: { "en-US": "Bad" },
          upperLabel: { "en-US": "Good" },
          validation: { logic: "or", rules: [{}, {}] },
        },
      ],
    },
    {
      id: "b2",
      name: "Second",
      elements: [{ id: "q3", type: "openText", headline: { "en-US": "Why?" }, required: false, inputType: "email" }],
      logic: [
        {
          id: "r",
          conditions: {
            id: "g",
            connector: "and",
            conditions: [
              {
                id: "c",
                leftOperand: { type: "element", value: "q1" },
                operator: "equals",
                rightOperand: { type: "static", value: "c1" },
              },
            ],
          },
          actions: [{ id: "a", objective: "jumpToBlock", target: "b2" }],
        },
      ],
    },
  ],
  endings: [
    { id: "e1", type: "endScreen", headline: { "en-US": "Thanks" } },
    { id: "e2", type: "redirectToUrl", url: "https://example.com", label: "Site" },
  ],
  hiddenFields: { enabled: true, fieldIds: ["plan"] },
  variables: [{ id: "v1", name: "score" }],
  distribution: null,
  targeting: null,
  visibility: "workspace",
};

describe("buildOutline", () => {
  test("numbers questions across blocks and reads text in the requested language", () => {
    const outline = buildOutline(survey, "de-DE");
    expect(outline.questionCount).toBe(3);
    expect(outline.blocks[0].questions.map((question) => question.number)).toEqual([1, 2]);
    expect(outline.blocks[1].questions[0].number).toBe(3);
    expect(outline.blocks[0].questions[0].headline).toBe("Wähle eins");
  });

  test("falls back to the default language and flags the missing translation", () => {
    const outline = buildOutline(survey, "de-DE");
    expect(outline.blocks[0].questions[1].headline).toBe("Rate");
    expect(outline.blocks[0].questions[1].missingTranslation).toBe(true);
    expect(buildOutline(survey, "en-US").blocks[0].questions[1].missingTranslation).toBe(false);
  });

  test("describes how each question is answered", () => {
    const { blocks } = buildOutline(survey, "en-US");
    expect(blocks[0].questions[0].details).toEqual(["2 options: A, B"]);
    expect(blocks[0].questions[1].details).toEqual([
      "5-point star scale",
      "Bad to Good",
      "2 validation rules (any of must pass)",
    ]);
    expect(blocks[1].questions[0].details).toEqual(["email input"]);
  });

  test("turns logic into sentences that name questions and blocks", () => {
    expect(buildOutline(survey, "en-US").blocks[1].logic).toEqual([
      'If Question 1 equals "A", jump to block 2 (Second).',
    ]);
  });

  test("reads welcome card as plain text, endings, hidden fields and variables", () => {
    const outline = buildOutline(survey, "en-US");
    expect(outline.welcome?.headline).toBe("Hello");
    expect(outline.endings.map((ending) => [ending.kind, ending.title])).toEqual([
      ["screen", "Thanks"],
      ["redirect", "Site"],
    ]);
    expect(outline.hiddenFields).toEqual(["plan"]);
    expect(outline.variables).toEqual(["score"]);
  });
});

const settings: PreviewSettings = {
  publishOn: null,
  closeOn: null,
  autoComplete: null,
  pinProtected: false,
  verifyEmail: false,
  singleUse: false,
  backButtonHidden: false,
  autoProgress: false,
  triggers: [],
  segment: null,
  displayOption: "displayOnce",
  displayPercentage: null,
  displayLimit: null,
  recontactDays: null,
  delaySeconds: 0,
  autoCloseSeconds: null,
};
const format = { date: (iso: string) => `date(${iso})`, number: (value: number) => String(value) };

describe("buildSettingLines", () => {
  test("leaves settings at their defaults out", () => {
    expect(buildSettingLines(survey, settings, format)).toEqual([]);
  });

  test("lists the schedule, limit and access settings", () => {
    const lines = buildSettingLines(
      { ...survey, visibility: "restricted" },
      { ...settings, publishOn: "2026-11-03T08:00:00.000Z", autoComplete: 500, pinProtected: true },
      format
    );
    expect(lines.map((line) => line.label)).toEqual(["Visibility", "Scheduled to start", "Response limit", "Access"]);
    expect(lines[1].value).toBe("date(2026-11-03T08:00:00.000Z)");
  });

  test("reports triggers and audience for app surveys only", () => {
    const withTriggers = { ...settings, triggers: [{ name: "Checkout", type: "code" }] };
    expect(buildSettingLines(survey, withTriggers, format)).toEqual([]);
    const lines = buildSettingLines({ ...survey, type: "app" }, withTriggers, format);
    expect(lines.find((line) => line.label === "Triggers")?.value).toBe("Checkout");
  });
});

describe("describeShowConditions", () => {
  test("reads page and device conditions in words", () => {
    const text = describeShowConditions({
      ...survey,
      distribution: {
        showConditions: {
          id: "g",
          connector: "and",
          conditions: [
            {
              id: "1",
              leftOperand: { type: "page", value: "currentUrl" },
              operator: "pathIsAnyOf",
              rightOperand: { type: "static", value: ["/a", "/b"] },
            },
            {
              id: "2",
              leftOperand: { type: "device", value: "deviceType" },
              operator: "equals",
              rightOperand: { type: "static", value: "desktop" },
            },
          ],
        },
      },
    });
    expect(text).toBe("page URL is one of /a, /b and device is desktop");
  });

  test("is empty when there are none", () => {
    expect(describeShowConditions(survey)).toBe("");
  });
});
