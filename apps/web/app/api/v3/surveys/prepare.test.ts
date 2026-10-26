import { describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { prepareV3SurveyCreate, prepareV3SurveyCreateInput, prepareV3SurveyPatchInput } from "./prepare";
import { type TV3SurveyDocument, ZV3CreateSurveyBody } from "./schemas";
import { serializeV3SurveyResource } from "./serializers";
import { getV3SurveyIntroducedMediaInvalidParams } from "./validation";

// ENG-3282: marker off, a session user — every survey reads as workspace-visible, no controls.
const TEST_VISIBILITY = {
  actorContext: { enforced: false, isOrganizationAdmin: false, kind: "user", userId: "user_1" },
  gates: { entitled: false, ready: false },
  ownerName: null,
} as const;

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

  test("parses a stored survey above a request array cap, and still refuses the cap on the request (ENG-3384)", () => {
    // The caps bound request input. A survey the editor built with more items than a cap has to stay
    // editable through v3 and MCP: on the first cut of the fix, a name-only patch of a 101-variable
    // survey returned 422 `stored_survey_invalid` (review on #9423).
    const variables = Array.from({ length: 101 }, (_unused, index) => ({
      id: `clvar${String(index).padStart(21, "0")}`,
      name: `score_${index}`,
      type: "number",
      value: 0,
    }));
    const oversizedStoredSurvey = { ...survey, variables } as unknown as TSurvey;

    const renamed = prepareV3SurveyPatchInput(oversizedStoredSurvey, { name: "Renamed" });
    expect(renamed.ok).toBe(true);

    const resent = prepareV3SurveyPatchInput(oversizedStoredSurvey, { variables });
    expect(resent.ok).toBe(false);
    if (!resent.ok) {
      expect(resent.origin).toBe("request");
      expect(resent.validation.invalidParams).toEqual([
        expect.objectContaining({ name: "variables", reason: "Too big: expected array to have <=100 items" }),
      ]);
    }
  });

  test("a draft holding an unfinished show condition stays patchable, without that condition", () => {
    // Autosave stores the row an author has not filled in yet. Parsed strictly, it made every patch
    // of the survey fail as `stored_survey_invalid` (review on #9655).
    const finished = {
      id: "cnd1",
      leftOperand: { type: "visit", value: "timeOnSite" },
      operator: "isGreaterThanOrEqual",
      rightOperand: { type: "static", value: 30 },
    };
    const unfinished = {
      id: "cnd2",
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "pathIsAnyOf",
    };
    const draftAppSurvey = {
      ...survey,
      type: "app",
      displayOption: "displayOnce",
      displayPercentage: null,
      displayLimit: null,
      recontactDays: null,
      autoClose: null,
      autoComplete: null,
      delay: 0,
      triggers: [],
      segment: null,
      showConditions: { id: "grp1", connector: "and", conditions: [finished, unfinished] },
    } as unknown as TSurvey;

    const renamed = prepareV3SurveyPatchInput(draftAppSurvey, { name: "Renamed" });

    expect(renamed.ok).toBe(true);
    expect(renamed.ok && renamed.document.distribution?.showConditions).toEqual({
      id: "grp1",
      connector: "and",
      conditions: [finished],
    });
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

  test("rejects a changed id, workspaceId, type, createdAt or archivedAt", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["id", { id: "clsvzzzzzzzzzzzzzzzzzzzzzz" }],
      ["workspaceId", { workspaceId: "clwszzzzzzzzzzzzzzzzzzzzzz" }],
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
    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY);

    const preparation = prepareV3SurveyPatchInput(survey, JSON.parse(JSON.stringify(resource)), {
      reportedVisibility: resource,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([]);
    }
  });

  test("round-trips a workspace language alias, and rejects a changed one as read-only", () => {
    // GET emits `languages[].alias` only when the workspace language has one; the default fixture has
    // none, so without this the strip-and-compare in prepare never runs.
    const withAlias = {
      ...survey,
      languages: survey.languages.map((entry) =>
        entry.language.code === "de-DE"
          ? { ...entry, language: { ...entry.language, alias: "German" } }
          : entry
      ),
    } as TSurvey;
    const resource = JSON.parse(JSON.stringify(serializeV3SurveyResource(withAlias, TEST_VISIBILITY)));

    expect(prepareV3SurveyPatchInput(withAlias, resource, { reportedVisibility: resource }).ok).toBe(true);

    const german = resource.languages.findIndex((language: { code: string }) => language.code === "de-DE");
    resource.languages[german].alias = "Deutsch";
    const changed = prepareV3SurveyPatchInput(withAlias, resource);

    expect(changed.ok).toBe(false);
    if (!changed.ok) {
      expect(changed.validation.invalidParams).toEqual([
        expect.objectContaining({
          name: `languages.${german}.alias`,
          code: "read_only_field",
          identifier: "Deutsch",
        }),
      ]);
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

  const forwardRecallPatch = {
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
  };

  test("but a patch that introduces a new forward recall is rejected", () => {
    const preparation = prepareV3SurveyPatchInput(survey, forwardRecallPatch);

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "misordered_reference" })])
      );
    }
  });

  test("create does not reject a forward recall — deliberately not a breaking change here", () => {
    // Turning the ordering rule on for create would reject payloads that succeed today. That needs a
    // version bump and a release note, which is its own change. Guards the decision so a future edit
    // to the default policy cannot make create breaking by accident.
    const preparation = prepareV3SurveyCreateInput({
      workspaceId,
      name: "Forward recall on create",
      blocks: [
        {
          id: "clbk1111111111111111111111",
          name: "A",
          elements: [
            {
              id: "q1",
              type: "openText",
              headline: { "en-US": "Hi #recall:q2/fallback:x#" },
              required: false,
            },
          ],
        },
        {
          id: "clbk2222222222222222222222",
          name: "B",
          elements: [{ id: "q2", type: "openText", headline: { "en-US": "Two" }, required: false }],
        },
      ],
    });

    expect(preparation.ok).toBe(true);
  });
});

describe("prepareV3SurveyPatchInput with cyclic block logic (ENG-3946)", () => {
  type TKey = "rate" | "why" | "pick";
  const ids: Record<TKey, string> = {
    rate: "clbkrate000000000000000000",
    why: "clbkwhy0000000000000000000",
    pick: "clbkpick000000000000000000",
  };
  const names: Record<TKey, string> = { rate: "Rate", why: "Why", pick: "Pick" };

  const jumpLogic = (from: TKey, to: TKey) => ({
    id: `cllogic${from}${to}`.padEnd(26, "0"),
    conditions: {
      id: `clgroup${from}${to}`.padEnd(26, "0"),
      connector: "and",
      conditions: [
        {
          id: `clcond${from}${to}`.padEnd(26, "0"),
          leftOperand: { type: "element", value: `q_${from}` },
          operator: "isSubmitted",
        },
      ],
    },
    actions: [{ id: `clact${from}${to}`.padEnd(26, "0"), objective: "jumpToBlock", target: ids[to] }],
  });

  // `Rate` jumps to `Pick` unless told otherwise. Stored as Rate → Why → Pick that is a plain skip; move
  // `Rate` after `Pick` and the jump points back at a block whose next step is `Rate` again — a loop.
  const buildBlocks = (
    localeKey: "default" | "en-US",
    order: TKey[],
    jumps: Partial<Record<TKey, TKey>> = { rate: "pick" }
  ) =>
    order.map((key) => {
      const target = jumps[key];
      return {
        id: ids[key],
        name: names[key],
        elements: [
          {
            id: `q_${key}`,
            type: "openText",
            headline: { [localeKey]: names[key], "de-DE": `${names[key]} (de)` },
            required: false,
          },
        ],
        ...(target ? { logic: [jumpLogic(key, target)] } : {}),
      };
    });

  const storedSurvey = (order: TKey[], jumps?: Partial<Record<TKey, TKey>>) =>
    ({ ...survey, blocks: buildBlocks("default", order, jumps) }) as unknown as TSurvey;

  const loopParam = (index: number, key: TKey) => ({
    name: `blocks.${String(index)}.logic`,
    reason: `Conditional Logic: Cyclic logic detected in block ${String(index + 1)} (${names[key]}).`,
  });

  test("rejects a reorder that turns a forward jump into a loop, naming only the blocks on it", () => {
    const preparation = prepareV3SurveyPatchInput(storedSurvey(["rate", "why", "pick"]), {
      blocks: buildBlocks("en-US", ["why", "pick", "rate"]),
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.origin).toBe("request");
      // `Why` only leads into the loop, so it is not reported.
      expect(preparation.validation.invalidParams).toEqual([loopParam(1, "pick"), loopParam(2, "rate")]);
    }
  });

  test("keeps a survey that already loops patchable, and accepts the patch that breaks the loop", () => {
    const looping = storedSurvey(["why", "pick", "rate"]);

    expect(prepareV3SurveyPatchInput(looping, { name: "Renamed" }).ok).toBe(true);
    expect(
      prepareV3SurveyPatchInput(looping, { blocks: buildBlocks("en-US", ["rate", "why", "pick"]) }).ok
    ).toBe(true);
  });

  test("accepts moving a block in front of an existing loop — it leads in, it is not on it", () => {
    const preparation = prepareV3SurveyPatchInput(storedSurvey(["pick", "rate", "why"]), {
      blocks: buildBlocks("en-US", ["why", "pick", "rate"]),
    });

    expect(preparation.ok).toBe(true);
  });

  test("rejects a new loop between blocks that already loop", () => {
    // Pick → Why → Rate → Pick already loops; a Pick → Rate jump is a second loop over the same blocks.
    const preparation = prepareV3SurveyPatchInput(storedSurvey(["pick", "why", "rate"]), {
      blocks: buildBlocks("en-US", ["pick", "why", "rate"], { rate: "pick", pick: "rate" }),
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual([loopParam(0, "pick")]);
    }
  });
});

describe("prepareV3SurveyPatchInput with a semantically invalid stored survey", () => {
  // ENG-3070 / ENG-3975. The stored survey parses fine but fails the semantic pass: `de-DE` is
  // configured and the headline has no German. A patch that leaves that issue as it was is accepted,
  // one that adds a new issue is refused, and one that repairs it is accepted.
  const storedInvalidSurvey = {
    ...survey,
    blocks: [
      {
        id: "clbk1234567890123456789012",
        name: "Main Block",
        elements: [
          {
            id: "satisfaction",
            type: "openText",
            headline: { "en-US": "What should we improve?" },
            required: true,
          },
        ],
      },
    ],
  } as unknown as TSurvey;

  test("accepts a rename that leaves the pre-existing issue as it was", () => {
    // ENG-3975: refusing this blocked the survey list's Rename on any survey with a stored issue.
    const result = prepareV3SurveyPatchInput(storedInvalidSurvey, { name: "Renamed" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.name).toBe("Renamed");
    expect(result.document.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "clbk1234567890123456789012" })])
    );
  });

  test("blames the request when it adds a new problem beside a pre-existing one", () => {
    // The rule is "one new issue makes the whole response the caller's". Every other request-blamed case
    // starts from a stored survey that validates clean and never reaches that comparison.
    const result = prepareV3SurveyPatchInput(storedInvalidSurvey, {
      endings: [{ id: "clend12345678901234567890", type: "endScreen", headline: { "en-US": "Bye" } }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.origin).toBe("request");
    expect(result.validation.invalidParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "blocks.0.elements.0.headline" }),
        expect.objectContaining({ name: "endings.0.headline" }),
      ])
    );
  });

  test("accepts a patch that repairs the offending field", () => {
    const result = prepareV3SurveyPatchInput(storedInvalidSurvey, {
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
    });

    // The whole point of the restructure: sending corrected values has to actually work. Judging the
    // stored document on its own makes this impossible, because the patch is never reached.
    expect(result.ok).toBe(true);
  });

  test("refuses replacing the offending element with another that has the same issue", () => {
    // Same path, code and identifier as the stored issue, but a different value: a new problem, not
    // the old one left alone.
    const result = prepareV3SurveyPatchInput(storedInvalidSurvey, {
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { "en-US": "How satisfied are you?" },
              required: true,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.origin).toBe("request");
    expect(result.validation.invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "blocks.0.elements.0.headline" })])
    );
  });

  test("refuses publishing a draft that still has the issue", () => {
    // The editor checks a draft in full before it goes live; leniency for untouched issues must not
    // become a way around that.
    const result = prepareV3SurveyPatchInput(storedInvalidSurvey, { status: "inProgress" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.origin).toBe("storedSurvey");
  });

  test("accepts a status change on a survey that is already live", () => {
    const result = prepareV3SurveyPatchInput({ ...storedInvalidSurvey, status: "inProgress" } as TSurvey, {
      status: "paused",
    });

    expect(result.ok).toBe(true);
  });
});

describe("prepareV3SurveyPatchInput with stored media that fails the media check", () => {
  // ENG-3975: an extension-less image URL saved before the check existed.
  const blockWithImage = (imageUrl: string) => ({
    id: "clbk1234567890123456789012",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { "en-US": "What should we improve?" },
        required: true,
        imageUrl,
      },
    ],
  });
  const storedBadMediaSurvey = {
    ...survey,
    languages: survey.languages.filter((language) => language.default),
    blocks: [blockWithImage("https://example.com/picture")],
  } as unknown as TSurvey;

  test("accepts a rename that leaves the media untouched", () => {
    expect(prepareV3SurveyPatchInput(storedBadMediaSurvey, { name: "Renamed" }).ok).toBe(true);
  });

  test("refuses a patch that swaps in another invalid media URL", () => {
    const result = prepareV3SurveyPatchInput(storedBadMediaSurvey, {
      blocks: [blockWithImage("https://example.com/other-picture")],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.origin).toBe("request");
  });
});

describe("getV3SurveyIntroducedMediaInvalidParams", () => {
  // The write path's own media check (`executeV3SurveyPatch`) compares against the stored survey's
  // internal blocks, not the v3 document — only the URLs have to line up.
  const blocks = (imageUrl: string) =>
    [
      {
        id: "clbk1234567890123456789012",
        name: "Main Block",
        elements: [{ id: "q", type: "openText", headline: {}, required: true, imageUrl }],
      },
    ] as unknown as TV3SurveyDocument["blocks"];

  test("reports nothing when every media URL is where it was", () => {
    expect(
      getV3SurveyIntroducedMediaInvalidParams(
        blocks("https://example.com/a"),
        blocks("https://example.com/a")
      )
    ).toEqual([]);
  });

  test("judges the media in full once a URL changed", () => {
    expect(
      getV3SurveyIntroducedMediaInvalidParams(
        blocks("https://example.com/b"),
        blocks("https://example.com/a")
      )
    ).toEqual([expect.objectContaining({ name: "blocks" })]);
  });
});

describe("prepareV3SurveyPatchInput failure attribution for cross-key breakage", () => {
  // The symmetric case to the language patch below, and the one the path-prefix heuristic got wrong.
  // Reference validation walks the whole merged document, so a request that submits only `blocks` —
  // which is *every* call to the two block endpoints, since they synthesize `{ blocks }` — can break
  // a recall living under `endings` and have it reported there. Attributing that to the stored survey
  // told the caller its request "was not evaluated" and to "repair them in the editor", about a survey
  // that was valid until that very call. ENG-3070's own failure mode, pointed the other way.
  const surveyRecalledFromEnding = {
    ...survey,
    endings: [
      {
        id: "clend1234567890123456789",
        type: "endScreen",
        headline: { "en-US": "Thanks #recall:satisfaction/fallback:there#" },
      },
    ],
  } as unknown as TSurvey;

  test("blames the request when a blocks-only patch orphans a recall under endings", () => {
    const result = prepareV3SurveyPatchInput(surveyRecalledFromEnding, {
      blocks: [
        {
          id: "clbk1234567890123456789099",
          name: "Replacement Block",
          elements: [
            {
              id: "clel1234567890123456789099",
              type: "openText",
              headline: { "en-US": "A different question" },
              required: false,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The problem is reported under `endings`, a key the request never sent — and it is still the
    // request's fault, because the stored survey validates clean.
    expect(result.validation.invalidParams.some((param) => param.name.startsWith("endings."))).toBe(true);
    expect(result.origin).toBe("request");
  });

  test("accepts a patch when the same problem pre-dates the request", () => {
    // Same shape, but the recall is already dangling before anything is patched. A patch that neither
    // repairs nor worsens it is accepted (ENG-3975).
    const alreadyBroken = {
      ...survey,
      endings: [
        {
          id: "clend1234567890123456789",
          type: "endScreen",
          headline: { "en-US": "Thanks #recall:neverexisted/fallback:there#" },
        },
      ],
    } as unknown as TSurvey;

    const result = prepareV3SurveyPatchInput(alreadyBroken, { name: "Renamed" });

    expect(result.ok).toBe(true);
  });
});

describe("prepareV3SurveyPatchInput failure attribution for language patches", () => {
  // A `languages` patch reaches every translatable map in the document, so adding a locale reports
  // `missing_translation` under `blocks` — a key the caller never sent. Attributing that to the
  // stored survey would tell the caller to repair a survey that was fine until this request.
  test("blames the request when a language-only patch adds an untranslated locale", () => {
    const result = prepareV3SurveyPatchInput(survey, {
      languages: [{ code: "en-US", default: true }, { code: "de-DE" }, { code: "fr-FR" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.validation.invalidParams.some((param) => param.name.startsWith("blocks."))).toBe(true);
    expect(result.origin).toBe("request");
  });
});

/**
 * The delta in `getIntroducedIssues` compares `invalidParamSignature` — `<path>\0<code>\0<recallId>` —
 * against the stored survey's own findings. The `introduced` precedence filter it is paired with keys
 * on `violation.key`, which is `recall|<scopeKey>|<recallId>`: a *scope*, not a path. Two different
 * lenses, so a violation the request genuinely introduced can carry the same signature as a stored one
 * while having a different scope — put a different element at the index the old one occupied, recalling
 * the same target, and the paths coincide.
 *
 * Validating the stored document under `enforce` put those stored precedence findings into the
 * pre-existing set, and the new violation matched one, so the caller was told its own edit was a
 * pre-existing problem with the survey — ENG-3070's misattribution through a side door.
 */
describe("patch attribution when a new violation lands on an old one's path", () => {
  const block = (blockId: string, elementId: string, headline: Record<string, string>) => ({
    id: blockId,
    name: "Block",
    elements: [{ id: elementId, type: "openText", headline, required: false }],
  });

  const RECALL = { "en-US": "See #recall:targetq/fallback:x#", "de-DE": "Siehe #recall:targetq/fallback:x#" };
  const PLAIN = { "en-US": "Target", "de-DE": "Ziel" };

  // `alphaq` recalls an element in a later block: a precedence violation the stored survey already has.
  const storedSurvey = {
    ...survey,
    blocks: [
      block("clbkmis0000000000000001", "alphaq", RECALL),
      block("clbkmis0000000000000002", "targetq", PLAIN),
    ],
  } as unknown as TSurvey;

  test("blames the request for a violation it introduced at that path, not the stored survey", () => {
    // Same position, same recall target, different element — so the signature collides with the stored
    // finding while the scope does not.
    const result = prepareV3SurveyPatchInput(storedSurvey, {
      blocks: [
        block("clbkmis0000000000000001", "betaq", RECALL),
        block("clbkmis0000000000000002", "targetq", PLAIN),
      ],
    } as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.origin).toBe("request");
  });
});

describe("visibility fields on PATCH (ENG-3282)", () => {
  const reported = serializeV3SurveyResource(survey, TEST_VISIBILITY);

  test("drops an exact echo of this caller's GET values", () => {
    const body = {
      name: "Renamed",
      visibility: reported.visibility,
      owner: reported.owner,
      access: reported.access,
    };

    expect(prepareV3SurveyPatchInput(survey, body, { reportedVisibility: reported }).ok).toBe(true);
  });

  test("refuses a changed visibility as an unsupported field — it changes only through POST …/visibility", () => {
    const preparation = prepareV3SurveyPatchInput(
      survey,
      { name: "Renamed", visibility: "restricted" },
      { reportedVisibility: reported }
    );

    expect(preparation.ok).toBe(false);
    if (preparation.ok) return;
    expect(preparation.validation.invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unsupported_field" })])
    );
  });
});
