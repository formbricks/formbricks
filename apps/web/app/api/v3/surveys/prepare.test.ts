import { describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { prepareV3SurveyCreate, prepareV3SurveyCreateInput, prepareV3SurveyPatchInput } from "./prepare";
import { ZV3CreateSurveyBody } from "./schemas";

vi.mock("server-only", () => ({}));

const workspaceId = "clxx1234567890123456789012";

const rawCreateBody = {
  workspaceId,
  name: "Product Feedback",
  defaultLanguage: "en-US",
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

  test("uses metadata translations when deriving required survey languages", () => {
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
            name: "metadata.title",
            code: "missing_translation",
            identifier: "de-DE",
            referenceType: "language",
          }),
          expect.objectContaining({
            name: "blocks.0.elements.0.headline",
            code: "missing_translation",
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

  test("rejects patch input with immutable fields as validation results", () => {
    const preparation = prepareV3SurveyPatchInput(survey, {
      workspaceId,
      defaultLanguage: "de-DE",
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "workspaceId",
            code: "unsupported_field",
          }),
          expect.objectContaining({
            name: "defaultLanguage",
            code: "unsupported_field",
          }),
        ])
      );
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
});
