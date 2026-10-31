import { describe, expect, test, vi } from "vitest";
import { DEFAULT_ENDING_CARD_BUTTON_LINK } from "@/lib/survey/default-ending-card";
import { checkImportDraft } from "@/modules/survey/import/core/final-gate";
import { fitFormbricksFileSurvey } from "./fit";

vi.mock("server-only", () => ({}));

const WORKSPACE_ID = "clworkspace0000000000001";
const ENDING_ID = "clending0000000000000001";
const REDIRECT_ID = "clending0000000000000002";

const ENDING_TEXTS = {
  "en-US": { headline: "Thank you!", subheader: "We appreciate your feedback." },
  "de-DE": { headline: "Vielen Dank!", subheader: "Wir schätzen dein Feedback." },
};

const allowAll = { allowExternalUrls: true, allowTargeting: true, defaultEndingTexts: ENDING_TEXTS };
const allowNothing = { allowExternalUrls: false, allowTargeting: false, defaultEndingTexts: ENDING_TEXTS };

const leaf = (id: string, connector: "and" | "or" | null, root: Record<string, unknown>, value: unknown) => ({
  id: `clfilter${id.padStart(16, "0")}`,
  connector,
  resource: {
    id: `clresource${id.padStart(14, "0")}`,
    root,
    qualifier: { operator: "equals" },
    value,
  },
});

const segmentFilter = (id: string, connector: "and" | "or" | null) =>
  leaf(id, connector, { type: "segment", segmentId: "clsegment000000000000001" }, "clsegment000000000000001");
const surveysFilter = (id: string, connector: "and" | "or" | null) =>
  leaf(
    id,
    connector,
    { type: "surveyInteraction" },
    { surveyScope: "specific", surveyIds: ["clsurvey0000000000000009"], interaction: "displayed" }
  );
const planFilter = (id: string, connector: "and" | "or" | null) =>
  leaf(id, connector, { type: "attribute", contactAttributeKey: "plan" }, "pro");

const survey = (overrides: Record<string, unknown> = {}) => ({
  name: "Onboarding NPS",
  type: "link",
  defaultLanguage: "en-US",
  languages: [
    { code: "en-US", default: true, enabled: true },
    { code: "de-DE", default: false, enabled: true },
  ],
  customCss: { light: ".fb-survey { color: red; }", dark: null },
  blocks: [
    {
      id: "clblock00000000000000001",
      name: "Block 1",
      elements: [
        {
          id: "book",
          type: "cta",
          headline: { "en-US": "Book a call", "de-DE": "Termin buchen" },
          required: false,
          buttonExternal: true,
          buttonUrl: "https://cal.example.com/sales",
          ctaButtonLabel: { "en-US": "Book", "de-DE": "Buchen" },
        },
      ],
      logic: [
        {
          id: "cllogic00000000000000001",
          conditions: {
            id: "clgroup00000000000000001",
            connector: "and",
            conditions: [
              {
                id: "clcondition0000000000001",
                leftOperand: { type: "element", value: "book" },
                operator: "isClicked",
              },
            ],
          },
          actions: [{ id: "claction0000000000000009", objective: "jumpToBlock", target: REDIRECT_ID }],
        },
      ],
    },
  ],
  endings: [
    {
      id: ENDING_ID,
      type: "endScreen",
      headline: { "en-US": "Done", "de-DE": "Fertig" },
      buttonLink: "https://example.com/pricing",
      buttonLabel: { "en-US": "See pricing", "de-DE": "Preise" },
    },
    { id: REDIRECT_ID, type: "redirectToUrl", url: "https://example.com/thanks", label: "Thanks page" },
  ],
  ...overrides,
});

describe("fitFormbricksFileSurvey", () => {
  test("keeps everything a workspace can hold, and drops a CSS key that holds no CSS without a word", () => {
    const fitted = fitFormbricksFileSurvey(survey({ customCss: null }), allowAll);

    expect(fitted.issues).toEqual([]);
    expect(fitted.survey).toEqual(survey({ customCss: undefined }));
    expect(fitted.survey).not.toHaveProperty("customCss");
  });

  test("removes custom CSS with a warning: styling is not part of an import", () => {
    const fitted = fitFormbricksFileSurvey(survey(), allowAll);

    expect(fitted.survey).not.toHaveProperty("customCss");
    expect(fitted.issues).toEqual([{ code: "custom_css_removed", severity: "warning" }]);
  });

  test("without external URLs, replaces the redirect ending under its id, unlinks the ending button and the CTA, and the draft still creates", () => {
    const fitted = fitFormbricksFileSurvey(survey({ customCss: null }), allowNothing);

    expect(fitted.survey.endings).toEqual([
      { id: ENDING_ID, type: "endScreen", headline: { "en-US": "Done", "de-DE": "Fertig" } },
      {
        id: REDIRECT_ID,
        type: "endScreen",
        headline: { "en-US": "Thank you!", "de-DE": "Vielen Dank!" },
        subheader: { "en-US": "We appreciate your feedback.", "de-DE": "Wir schätzen dein Feedback." },
      },
    ]);
    expect(fitted.survey.blocks).toMatchObject([
      { elements: [{ id: "book", type: "cta", buttonExternal: false }] },
    ]);
    const [cta] = (fitted.survey.blocks as { elements: Record<string, unknown>[] }[])[0].elements;
    expect(cta).not.toHaveProperty("buttonUrl");
    expect(fitted.issues).toEqual([
      { code: "external_url_removed", severity: "warning", params: { subject: "ending" } },
      { code: "external_url_removed", severity: "warning", params: { subject: "ending" } },
      { code: "external_url_removed", severity: "warning", questionTag: "book" },
      // A rule asking whether the CTA was clicked cannot stay once it has no external button.
      { code: "logic_not_imported", severity: "warning", params: { block: "Block 1" } },
    ]);
    expect(fitted.survey.blocks).toMatchObject([{ logic: [] }]);
    expect(
      checkImportDraft({
        ...fitted.survey,
        workspaceId: WORKSPACE_ID,
        name: "Onboarding NPS",
        status: "draft",
        blocks: fitted.survey.blocks as { elements: unknown[] }[],
      })
    ).toEqual([]);
  });

  test("keeps a default ending link, which is not an external URL", () => {
    const fitted = fitFormbricksFileSurvey(
      survey({
        customCss: null,
        endings: [
          {
            id: ENDING_ID,
            type: "endScreen",
            headline: { "en-US": "Done" },
            buttonLink: DEFAULT_ENDING_CARD_BUTTON_LINK,
            buttonLabel: { "en-US": "Create your own" },
          },
        ],
        blocks: [],
      }),
      allowNothing
    );

    expect(fitted.issues).toEqual([]);
    expect(fitted.survey.endings).toMatchObject([{ buttonLink: DEFAULT_ENDING_CARD_BUTTON_LINK }]);
  });

  test("removes targeting whole when the plan has no contact targeting", () => {
    const fitted = fitFormbricksFileSurvey(
      survey({ type: "app", customCss: null, targeting: { filters: [planFilter("1", null)] } }),
      { ...allowAll, allowTargeting: false }
    );

    expect(fitted.survey).not.toHaveProperty("targeting");
    expect(fitted.issues).toEqual([{ code: "targeting_removed", severity: "warning" }]);
  });

  test("removes the filters that point at a segment or at surveys, nested ones too, and keeps the rest well-formed", () => {
    const fitted = fitFormbricksFileSurvey(
      survey({
        type: "app",
        customCss: null,
        targeting: {
          filters: [
            segmentFilter("1", null),
            planFilter("2", "and"),
            { id: "clgroupfilter00000000001", connector: "or", resource: [surveysFilter("3", null)] },
            {
              id: "clgroupfilter00000000002",
              connector: "and",
              resource: [surveysFilter("4", null), planFilter("5", "or")],
            },
          ],
        },
      }),
      allowAll
    );

    expect(fitted.survey.targeting).toEqual({
      filters: [
        planFilter("2", null),
        { id: "clgroupfilter00000000002", connector: "and", resource: [planFilter("5", null)] },
      ],
    });
    expect(fitted.issues).toEqual([
      { code: "targeting_filter_removed", severity: "warning", params: { count: 3 } },
    ]);
  });

  test("leaves its input untouched", () => {
    const input = survey();
    fitFormbricksFileSurvey(input, allowNothing);
    expect(input).toEqual(survey());
  });
});
