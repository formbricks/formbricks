import { describe, expect, test } from "vitest";
import { validateV3SurveyReferences } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";

const validSurvey = ZV3CreateSurveyBody.parse({
  workspaceId: "clxx1234567890123456789012",
  name: "Product Feedback",
  hiddenFields: {
    enabled: true,
    fieldIds: ["account_id"],
  },
  variables: [
    {
      id: "clvar123456789012345678901",
      name: "score",
      type: "number",
      value: 0,
    },
  ],
  endings: [
    {
      id: "clend123456789012345678901",
      type: "endScreen",
      headline: { "en-US": "Thanks" },
    },
  ],
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      logicFallback: "clend123456789012345678901",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: { "en-US": "What should we improve?" },
          required: true,
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
                leftOperand: { type: "element", value: "satisfaction" },
                operator: "isSubmitted",
              },
            ],
          },
          actions: [
            {
              id: "clact123456789012345678901",
              objective: "calculate",
              variableId: "clvar123456789012345678901",
              operator: "add",
              value: { type: "static", value: 1 },
            },
          ],
        },
      ],
    },
  ],
});

describe("validateV3SurveyReferences", () => {
  test("accepts a survey with consistent stable identifiers", () => {
    expect(
      validateV3SurveyReferences({
        blocks: validSurvey.blocks,
        endings: validSurvey.endings,
        hiddenFields: validSurvey.hiddenFields,
        variables: validSurvey.variables,
      })
    ).toEqual({ ok: true, invalidParams: [] });
  });

  test("rejects duplicate block, element, variable, and hidden field identifiers", () => {
    const survey = {
      ...validSurvey,
      hiddenFields: { enabled: true, fieldIds: ["account_id", "account_id"] },
      variables: [
        ...validSurvey.variables,
        {
          id: "clvar123456789012345678901",
          name: "score",
          type: "number" as const,
          value: 0,
        },
      ],
      blocks: [
        ...validSurvey.blocks,
        {
          ...validSurvey.blocks[0],
          elements: [{ ...validSurvey.blocks[0].elements[0] }],
        },
      ],
    };

    const result = validateV3SurveyReferences({
      blocks: survey.blocks,
      endings: survey.endings,
      hiddenFields: survey.hiddenFields,
      variables: survey.variables,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "blocks.1.id" }),
          expect.objectContaining({ name: "blocks.1.elements.0.id" }),
          expect.objectContaining({ name: "variables.1.id" }),
          expect.objectContaining({ name: "hiddenFields.fieldIds.1" }),
          expect.objectContaining({
            name: "blocks.1.id",
            code: "duplicate_identifier",
            identifier: "clbk1234567890123456789012",
            referenceType: "block",
            firstUsedAt: "blocks.0.id",
          }),
        ])
      );
    }
  });

  test("rejects cross-namespace identifier collisions", () => {
    const result = validateV3SurveyReferences({
      blocks: validSurvey.blocks,
      endings: validSurvey.endings,
      hiddenFields: { enabled: true, fieldIds: ["account_id", "satisfaction"] },
      variables: [
        {
          id: "satisfaction",
          name: "account_id",
          type: "number",
          value: 0,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "hiddenFields.fieldIds.1" }),
          expect.objectContaining({ name: "variables.0.id" }),
          expect.objectContaining({ name: "variables.0.name" }),
          expect.objectContaining({
            name: "hiddenFields.fieldIds.1",
            code: "duplicate_identifier",
            identifier: "satisfaction",
            referenceType: "hiddenField",
            conflictsWith: "blocks.0.elements.0.id",
          }),
        ])
      );
    }
  });

  test("reports dangling logic references with actionable paths", () => {
    const survey = {
      ...validSurvey,
      blocks: [
        {
          ...validSurvey.blocks[0],
          logicFallback: "clmiss12345678901234567890",
          logic: [
            {
              ...validSurvey.blocks[0].logic![0],
              actions: [
                {
                  ...validSurvey.blocks[0].logic![0].actions[0],
                  variableId: "clmiss12345678901234567890",
                },
                {
                  id: "cljmp123456789012345678901",
                  objective: "jumpToBlock" as const,
                  target: "clmiss12345678901234567890",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = validateV3SurveyReferences({
      blocks: survey.blocks,
      endings: survey.endings,
      hiddenFields: survey.hiddenFields,
      variables: survey.variables,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "blocks.0.logicFallback" }),
          expect.objectContaining({ name: "blocks.0.logic.0.actions.0.variableId" }),
          expect.objectContaining({ name: "blocks.0.logic.0.actions.1.target" }),
          expect.objectContaining({
            name: "blocks.0.logic.0.actions.0.variableId",
            code: "dangling_reference",
            missingId: "clmiss12345678901234567890",
            referenceType: "variable",
          }),
        ])
      );
    }
  });

  test("rejects logicFallback without logic before persistence", () => {
    const survey = {
      ...validSurvey,
      blocks: [
        {
          ...validSurvey.blocks[0],
          logic: undefined,
          logicFallback: validSurvey.endings[0].id,
        },
      ],
    };

    const result = validateV3SurveyReferences({
      blocks: survey.blocks,
      endings: survey.endings,
      hiddenFields: survey.hiddenFields,
      variables: survey.variables,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.logicFallback",
            code: "invalid_reference",
            reason:
              "logicFallback requires at least one logic rule on the same block; omit logicFallback for normal sequential flow or add blocks[].logic",
            referenceType: "ending",
          }),
        ])
      );
    }
  });

  test("rejects logicFallback targeting the same block", () => {
    const survey = {
      ...validSurvey,
      blocks: [
        {
          ...validSurvey.blocks[0],
          logicFallback: validSurvey.blocks[0].id,
        },
      ],
    };

    const result = validateV3SurveyReferences({
      blocks: survey.blocks,
      endings: survey.endings,
      hiddenFields: survey.hiddenFields,
      variables: survey.variables,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.logicFallback",
            code: "invalid_reference",
            reason: "logicFallback cannot target the same block",
          }),
        ])
      );
    }
  });

  test("reports dangling recall references with actionable paths", () => {
    const survey = {
      ...validSurvey,
      blocks: [
        {
          ...validSurvey.blocks[0],
          elements: [
            {
              ...validSurvey.blocks[0].elements[0],
              headline: {
                default: "Please explain #recall:missing_id/fallback:your answer#",
              },
            },
          ],
        },
      ],
    };

    const result = validateV3SurveyReferences({
      blocks: survey.blocks,
      endings: survey.endings,
      hiddenFields: survey.hiddenFields,
      variables: survey.variables,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline.default",
            reason: expect.stringContaining("missing_id"),
            code: "dangling_reference",
            missingId: "missing_id",
            referenceType: "recall",
          }),
        ])
      );
    }
  });

  test("reports dangling recall references in survey-level translatable fields", () => {
    const result = validateV3SurveyReferences({
      blocks: validSurvey.blocks,
      endings: validSurvey.endings,
      hiddenFields: validSurvey.hiddenFields,
      metadata: {
        title: {
          default: "Metadata #recall:missing_metadata_reference/fallback:value#",
        },
      },
      variables: validSurvey.variables,
      welcomeCard: {
        enabled: true,
        headline: {
          default: "Welcome #recall:missing_welcome_reference/fallback:there#",
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidParams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "welcomeCard.headline.default",
            reason: expect.stringContaining("missing_welcome_reference"),
          }),
          expect.objectContaining({
            name: "metadata.title.default",
            reason: expect.stringContaining("missing_metadata_reference"),
          }),
        ])
      );
    }
  });

  test("ignores recall-like strings in arbitrary metadata values", () => {
    const result = validateV3SurveyReferences({
      blocks: validSurvey.blocks,
      endings: validSurvey.endings,
      hiddenFields: validSurvey.hiddenFields,
      metadata: {
        cx_operation: "Enterprise #recall:external_context/fallback:context#",
      },
      variables: validSurvey.variables,
    });

    expect(result).toEqual({ ok: true, invalidParams: [] });
  });
});
