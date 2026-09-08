import { describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { prepareV3SurveyCreate, prepareV3SurveyCreateInput, prepareV3SurveyPatchInput } from "./prepare";
import { ZV3CreateSurveyBody } from "./schemas";
import { serializeV3SurveyResource } from "./serializers";

vi.mock("server-only", () => ({}));

const workspaceId = "clxx1234567890123456789012";

const rawCreateBody = {
  workspaceId,
  name: "Product Feedback",
  defaultLanguage: "en-US",
  languages: [{ code: "de-DE", enabled: true }],
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: { "en-US": "What should we improve?", "de-DE": "Was sollen wir verbessern?" },
          required: true,
        },
      ],
    },
  ],
};

const createBody = ZV3CreateSurveyBody.parse(rawCreateBody);

const survey = {
  id: "clsv1234567890123456789012",
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  status: "draft",
  metadata: {},
  languages: [
    {
      language: {
        id: "cllangdede000000000000000",
        code: "de-DE",
        alias: null,
        workspaceId,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
      default: false,
      enabled: true,
    },
    {
      language: {
        id: "cllangenus000000000000000",
        code: "en-US",
        alias: null,
        workspaceId,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
      default: true,
      enabled: true,
    },
  ],
  questions: [],
  welcomeCard: { enabled: false },
  blocks: createBody.blocks,
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
} as unknown as TSurvey;

function createLegacyLanguageSurvey(code: string, options?: { defaultLanguage?: string }): TSurvey {
  const defaultLanguage = options?.defaultLanguage ?? code;
  const defaultLanguageEntry = {
    language: {
      id: `cllang${defaultLanguage.replaceAll("-", "").toLowerCase()}000000000000000`,
      code: defaultLanguage,
      alias: null,
      workspaceId,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    },
    default: true,
    enabled: true,
  };
  const legacyLanguageEntry =
    code === defaultLanguage
      ? null
      : {
          language: {
            id: `cllang${code.replaceAll("-", "").toLowerCase()}000000000000000`,
            code,
            alias: null,
            workspaceId,
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
            updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          },
          default: false,
          enabled: true,
        };

  return {
    ...survey,
    name: `Legacy ${code} survey`,
    languages: legacyLanguageEntry ? [legacyLanguageEntry, defaultLanguageEntry] : [defaultLanguageEntry],
    blocks: [
      {
        id: "clbk1234567890123456789012",
        name: "Legacy Block",
        elements: [
          {
            id: "legacy_feedback",
            type: "openText",
            headline:
              code === defaultLanguage
                ? { default: "Tell us more" }
                : { default: "Tell us more", [code]: "Tell us more translated" },
            required: true,
          },
        ],
      },
    ],
  } as unknown as TSurvey;
}

describe("v3 survey preparation", () => {
  test("prepares a valid create document and derives language side effects", () => {
    const preparation = prepareV3SurveyCreate(createBody);

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      throw new Error("Expected create preparation to succeed");
    }
    expect(preparation.languageRequests).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
  });

  test("returns validation results instead of throwing for invalid create input", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              ...rawCreateBody.blocks[0].elements[0],
              buttonUrl: "https://example.com",
            },
          ],
        },
      ],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.buttonUrl",
            code: "unsupported_field",
          }),
        ])
      );
    }
  });

  test("rejects configured languages that are missing from translatable survey content", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      languages: [{ code: "pt-PT", enabled: true }],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline",
            code: "missing_translation",
            identifier: "pt-PT",
            referenceType: "language",
          }),
        ])
      );
    }
  });

  test("rejects partial derived translations before internal survey validation", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              ...rawCreateBody.blocks[0].elements[0],
              subheader: { "en-US": "Tell us more" },
            },
          ],
        },
      ],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.subheader",
            code: "missing_translation",
            identifier: "de-DE",
            referenceType: "language",
          }),
        ])
      );
    }
  });

  test("rejects metadata translations that are missing configured languages", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      metadata: {
        title: { "en-US": "Product Feedback" },
      },
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "metadata.title",
            code: "missing_translation",
            identifier: "de-DE",
            referenceType: "language",
          }),
        ])
      );
    }
  });

  test("rejects undeclared locale keys in translatable survey content", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      languages: [],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline.de-DE",
            code: "unsupported_locale",
            identifier: "de-DE",
            referenceType: "language",
          }),
        ])
      );
    }
  });

  test("rejects undeclared locale keys in translatable metadata fields", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      metadata: {
        title: { "en-US": "Product Feedback", "fr-FR": "Retour produit" },
      },
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "metadata.title.fr-FR",
            code: "unsupported_locale",
            identifier: "fr-FR",
            referenceType: "language",
          }),
        ])
      );
    }
  });

  test("returns language and reference validation issues together", () => {
    const preparation = prepareV3SurveyCreateInput({
      ...rawCreateBody,
      languages: [{ code: "pt-PT", enabled: true }],
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          logicFallback: "clmiss12345678901234567890",
        },
      ],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline",
            code: "missing_translation",
          }),
          expect.objectContaining({
            name: "blocks.0.logicFallback",
            code: "dangling_reference",
          }),
        ])
      );
    }
  });

  test("applies a patch over the current document before validating references", () => {
    const preparation = prepareV3SurveyPatchInput(survey, {
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          logicFallback: "clmiss12345678901234567890",
        },
      ],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "blocks.0.logicFallback" })])
      );
    }
  });

  test("rejects a changed server-owned field with read_only_field (ENG-3069)", () => {
    // Echoing the value GET returned is a no-op; changing one is the error. workspaceId here matches
    // the survey, so only defaultLanguage is reported.
    const preparation = prepareV3SurveyPatchInput(survey, {
      name: "Renamed",
      workspaceId,
      defaultLanguage: "de-DE",
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([
        expect.objectContaining({
          name: "defaultLanguage",
          code: "read_only_field",
          identifier: "de-DE",
          referenceType: "language",
        }),
      ]);
    }
  });

  test("rejects a changed id, type, createdAt or archivedAt", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["id", { id: "clsvzzzzzzzzzzzzzzzzzzzzzz" }],
      ["type", { type: "app" }],
      ["createdAt", { createdAt: "2020-01-01T00:00:00.000Z" }],
      ["archivedAt", { archivedAt: "2020-01-01T00:00:00.000Z" }],
    ];

    for (const [field, patch] of cases) {
      const preparation = prepareV3SurveyPatchInput(survey, { name: "Renamed", ...patch });
      expect(preparation.ok, field).toBe(false);
      if (!preparation.ok) {
        expect(preparation.validation.invalidParams).toEqual([
          expect.objectContaining({ name: field, code: "read_only_field" }),
        ]);
      }
    }
  });

  test("rejects patch language changes that try to move the default language", () => {
    const preparation = prepareV3SurveyPatchInput(survey, {
      languages: [{ code: "de-DE", default: true, enabled: true }],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "languages.0.default",
            reason: "The default language entry must match defaultLanguage",
          }),
        ])
      );
    }
  });

  test("preserves omitted fields while replacing provided top-level patch fields", () => {
    const preparation = prepareV3SurveyPatchInput(survey, {
      name: "Updated Product Feedback",
      metadata: {
        title: { "en-US": "Updated title", "de-DE": "Aktualisierter Titel" },
      },
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      throw new Error("Expected patch preparation to succeed");
    }
    expect(preparation.document).toMatchObject({
      name: "Updated Product Feedback",
      metadata: { title: { default: "Updated title", "de-DE": "Aktualisierter Titel" } },
      blocks: survey.blocks,
      hiddenFields: survey.hiddenFields,
    });
  });

  test("patches the name of a survey with an existing legacy language-only code", () => {
    const preparation = prepareV3SurveyPatchInput(
      createLegacyLanguageSurvey("vi", { defaultLanguage: "en-US" }),
      {
        name: "Updated legacy vi survey",
      }
    );

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      throw new Error("Expected patch preparation to succeed");
    }
    expect(preparation.document.name).toBe("Updated legacy vi survey");
    expect(preparation.document.languages).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "vi", default: false })])
    );
    expect(preparation.languageRequests).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "vi", default: false })])
    );
  });

  test("preserves canonical translation keys during patch preparation", () => {
    const preparation = prepareV3SurveyPatchInput(
      createLegacyLanguageSurvey("hi-IN", { defaultLanguage: "en-US" }),
      {
        name: "Updated hi-IN survey",
      }
    );

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      throw new Error("Expected patch preparation to succeed");
    }
    expect(preparation.document.languages).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "hi-IN", default: false })])
    );
    expect(preparation.document.blocks[0].elements[0]).toMatchObject({
      headline: { default: "Tell us more", "hi-IN": "Tell us more translated" },
    });
    expect(preparation.languageRequests).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "hi-IN", default: false })])
    );
  });

  test("patches translatable metadata for a survey with an existing legacy default language", () => {
    const preparation = prepareV3SurveyPatchInput(createLegacyLanguageSurvey("gu"), {
      metadata: {
        title: { gu: "Legacy Gujarati survey" },
      },
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      throw new Error("Expected patch preparation to succeed");
    }
    expect(preparation.document.defaultLanguage).toBe("gu");
    expect(preparation.document.metadata).toMatchObject({
      title: { default: "Legacy Gujarati survey" },
    });
    expect(preparation.languageRequests).toEqual([{ code: "gu", default: true, enabled: true }]);
  });

  test("allows patch languages to keep an existing legacy code but not introduce a new one", () => {
    const legacyPreparation = prepareV3SurveyPatchInput(createLegacyLanguageSurvey("gu"), {
      languages: [{ code: "gu", default: true, enabled: true }],
    });

    expect(legacyPreparation.ok).toBe(true);

    const canonicalPreparation = prepareV3SurveyPatchInput(survey, {
      languages: [{ code: "gu", enabled: true }],
    });

    expect(canonicalPreparation.ok).toBe(false);
    if (!canonicalPreparation.ok) {
      expect(canonicalPreparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "languages.0.code",
            code: "invalid_locale",
          }),
        ])
      );
    }
  });

  test("still rejects undeclared canonical locale keys in patch translatable fields", () => {
    const preparation = prepareV3SurveyPatchInput(createLegacyLanguageSurvey("gu"), {
      metadata: {
        title: { gu: "Legacy Gujarati survey", "de-DE": "Legacy survey" },
      },
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "metadata.title.de-DE",
            code: "unsupported_locale",
          }),
        ])
      );
    }
  });

  test("rejects non-draft element id changes on non-draft surveys", () => {
    const preparation = prepareV3SurveyPatchInput(
      {
        ...survey,
        status: "inProgress",
      } as TSurvey,
      {
        blocks: [
          {
            ...rawCreateBody.blocks[0],
            elements: [
              {
                ...rawCreateBody.blocks[0].elements[0],
                id: "renamed_satisfaction",
              },
            ],
          },
        ],
      }
    );

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.id",
            reason: expect.stringContaining("cannot be changed"),
            code: "immutable_identifier",
            identifier: "satisfaction",
            referenceType: "element",
          }),
        ])
      );
    }
  });

  test("accepts its own GET output unchanged — the round trip (ENG-3069)", () => {
    // The regression this whole change exists for: fetch a survey, send it straight back, and the
    // eight server-owned fields GET emits used to produce a 400 naming fields the caller never chose.
    const resource = serializeV3SurveyResource(survey);

    const preparation = prepareV3SurveyPatchInput(survey, JSON.parse(JSON.stringify(resource)));

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([]);
    }
  });

  test("surfaces a round-tripped updatedAt as the write precondition, without comparing it", () => {
    const stale = "2020-01-01T00:00:00.000Z";

    const preparation = prepareV3SurveyPatchInput(survey, { name: "Renamed", updatedAt: stale });

    expect(preparation.ok).toBe(true);
    if (preparation.ok) {
      // Not an error here: staleness is enforced by the compare-and-set at the write.
      expect(preparation.precondition).toEqual({ expectedUpdatedAt: new Date(stale) });
    }
  });

  test("rejects an updatedAt that is not a date-time", () => {
    const preparation = prepareV3SurveyPatchInput(survey, { name: "Renamed", updatedAt: "yesterday" });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([
        expect.objectContaining({ name: "updatedAt", code: "read_only_field" }),
      ]);
    }
  });

  test("a survey that already contains a forward recall stays patchable (ENG-3070 class)", () => {
    // Regression: building the current document must not enforce the ordering rule. Judging the
    // stored survey there made an unrelated { name } patch fail with the survey's own violations —
    // exactly the bricking this rule was designed not to cause. Caught by the real-Postgres smoke.
    const withForwardRecall = {
      ...survey,
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { default: "Hi #recall:later_q/fallback:x#", "de-DE": "Hallo" },
              required: true,
            },
          ],
        },
        {
          id: "clbk9999999999999999999999",
          name: "Later Block",
          elements: [
            {
              id: "later_q",
              type: "openText",
              headline: { default: "Later", "de-DE": "Spaeter" },
              required: false,
            },
          ],
        },
      ],
    } as unknown as TSurvey;

    const preparation = prepareV3SurveyPatchInput(withForwardRecall, { name: "Renamed" });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([]);
    }
  });

  test("but a patch that introduces a new forward recall is rejected", () => {
    const preparation = prepareV3SurveyPatchInput(survey, {
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: {
                "en-US": "Hi #recall:later_q/fallback:x#",
                "de-DE": "Hallo #recall:later_q/fallback:x#",
              },
              required: true,
            },
          ],
        },
        {
          id: "clbk9999999999999999999999",
          name: "Later Block",
          elements: [
            {
              id: "later_q",
              type: "openText",
              headline: { "en-US": "Later", "de-DE": "Spaeter" },
              required: false,
            },
          ],
        },
      ],
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "misordered_reference" })])
      );
    }
  });
});
