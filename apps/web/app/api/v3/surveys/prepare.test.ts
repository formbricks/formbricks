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
        expect.arrayContaining([expect.objectContaining({ name: "blocks.0.elements.0.buttonUrl" })])
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
    });

    expect(preparation.ok).toBe(false);
    if (!preparation.ok) {
      expect(preparation.validation.invalidParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "workspaceId" })])
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
          }),
        ])
      );
    }
  });
});
