import { describe, expect, test } from "vitest";
import {
  getV3SurveyIntroducedPrecedenceInvalidParams,
  getV3SurveyPrecedenceInvalidParams,
  validateV3SurveyReferences,
} from "./reference-validation";
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

  test("rejects duplicate block, ending, element, variable, and hidden field identifiers", () => {
    const survey = {
      ...validSurvey,
      hiddenFields: { enabled: true, fieldIds: ["account_id", "account_id"] },
      endings: [...validSurvey.endings, { ...validSurvey.endings[0] }],
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
          expect.objectContaining({ name: "endings.1.id" }),
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

describe("ordering rules (ENG-3069)", () => {
  const twoBlockSurvey = (overrides: Record<string, unknown> = {}) =>
    ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Ordered",
      hiddenFields: { enabled: true, fieldIds: ["account_id"] },
      variables: [],
      endings: [{ id: "clend12345678901234567890", type: "endScreen", headline: { "en-US": "Thanks" } }],
      blocks: [
        {
          id: "clbk1111111111111111111111",
          name: "First",
          elements: [{ id: "first_q", type: "openText", headline: { "en-US": "One" }, required: false }],
        },
        {
          id: "clbk2222222222222222222222",
          name: "Second",
          elements: [{ id: "second_q", type: "openText", headline: { "en-US": "Two" }, required: false }],
        },
      ],
      ...overrides,
    });

  const refInput = (survey: ReturnType<typeof twoBlockSurvey>) => ({
    blocks: survey.blocks,
    endings: survey.endings,
    hiddenFields: survey.hiddenFields,
    metadata: survey.metadata,
    variables: survey.variables,
    welcomeCard: survey.welcomeCard,
  });

  const withHeadline = (blockIndex: number, headline: string) => {
    const survey = twoBlockSurvey();
    survey.blocks[blockIndex].elements[0].headline = { "en-US": headline } as never;
    return survey;
  };

  test("flags a recall of an element in a later block", () => {
    const params = getV3SurveyPrecedenceInvalidParams(
      refInput(withHeadline(0, "Hi #recall:second_q/fallback:friend#"))
    );

    expect(params).toEqual([
      expect.objectContaining({
        name: "blocks.0.elements.0.headline.en-US",
        code: "misordered_reference",
        identifier: "second_q",
        referenceType: "recall",
      }),
    ]);
  });

  test("allows a recall of an earlier element, and never flags hidden fields", () => {
    expect(
      getV3SurveyPrecedenceInvalidParams(refInput(withHeadline(1, "Hi #recall:first_q/fallback:x#")))
    ).toEqual([]);
    expect(
      getV3SurveyPrecedenceInvalidParams(refInput(withHeadline(0, "Hi #recall:account_id/fallback:x#")))
    ).toEqual([]);
  });

  test("flags an element recall in the welcome card, where no answer exists yet", () => {
    const survey = twoBlockSurvey({
      welcomeCard: { enabled: true, headline: { "en-US": "Hi #recall:first_q/fallback:x#" } },
    });

    expect(getV3SurveyPrecedenceInvalidParams(refInput(survey))[0]).toMatchObject({
      // The create schema normalizes the locale-keyed map to the internal default key.
      name: "welcomeCard.headline.default",
      code: "misordered_reference",
    });
  });

  test("never flags a recall in an ending, which comes after everything", () => {
    const survey = twoBlockSurvey();
    (survey.endings[0] as Record<string, unknown>).headline = {
      "en-US": "Bye #recall:second_q/fallback:x#",
    };

    expect(getV3SurveyPrecedenceInvalidParams(refInput(survey))).toEqual([]);
  });

  test("flags a condition whose element operand is in a later block, but not the same block", () => {
    const later = twoBlockSurvey();
    later.blocks[0].logic = [
      {
        id: "cllogic11111111111111111",
        conditions: {
          id: "clcond11111111111111111",
          connector: "and",
          conditions: [
            {
              id: "clcond22222222222222222",
              leftOperand: { type: "element", value: "second_q" },
              operator: "isSubmitted",
            },
          ],
        },
        actions: [],
      },
    ] as never;

    expect(getV3SurveyPrecedenceInvalidParams(refInput(later))[0]).toMatchObject({
      code: "misordered_reference",
      identifier: "second_q",
      referenceType: "element",
    });

    const sameBlock = twoBlockSurvey();
    sameBlock.blocks[0].logic = [
      {
        id: "cllogic11111111111111111",
        conditions: {
          id: "clcond11111111111111111",
          connector: "and",
          conditions: [
            {
              id: "clcond22222222222222222",
              leftOperand: { type: "element", value: "first_q" },
              operator: "isSubmitted",
            },
          ],
        },
        actions: [],
      },
    ] as never;

    expect(getV3SurveyPrecedenceInvalidParams(refInput(sameBlock))).toEqual([]);
  });

  test("keeps jumping backwards legal", () => {
    const survey = twoBlockSurvey();
    survey.blocks[1].logic = [
      {
        id: "cllogic11111111111111111",
        conditions: {
          id: "clcond11111111111111111",
          connector: "and",
          conditions: [
            {
              id: "clcond22222222222222222",
              leftOperand: { type: "element", value: "second_q" },
              operator: "isSubmitted",
            },
          ],
        },
        actions: [
          { id: "clact111111111111111111", objective: "jumpToBlock", target: "clbk1111111111111111111111" },
        ],
      },
    ] as never;

    expect(getV3SurveyPrecedenceInvalidParams(refInput(survey))).toEqual([]);
  });

  test("reports only what a change introduces, and survives a reorder shifting indices", () => {
    // The whole reason this is a delta: a survey that already recalls forwards must stay patchable,
    // including by a patch that never touches the offending block.
    const broken = withHeadline(0, "Hi #recall:second_q/fallback:x#");

    expect(getV3SurveyIntroducedPrecedenceInvalidParams(refInput(broken), refInput(broken))).toEqual([]);

    // Three blocks, because the violation has to *survive* the reorder for this to prove anything.
    // Recall sits in block 0 and points at block 2; swapping blocks 1 and 2 keeps it pointing
    // forwards while moving the target from `blocks.2` to `blocks.1`. A two-block reverse would make
    // the recall point backwards instead, leaving zero violations and an empty delta no matter how
    // the keys are built — which would pass even if index-based keys came back.
    const threeBlocks = () =>
      twoBlockSurvey({
        blocks: [
          {
            id: "clbk1111111111111111111111",
            name: "First",
            elements: [
              {
                id: "first_q",
                type: "openText",
                headline: { "en-US": "Hi #recall:third_q/fallback:x#" },
                required: false,
              },
            ],
          },
          {
            id: "clbk2222222222222222222222",
            name: "Second",
            elements: [{ id: "second_q", type: "openText", headline: { "en-US": "Two" }, required: false }],
          },
          {
            id: "clbk3333333333333333333333",
            name: "Third",
            elements: [{ id: "third_q", type: "openText", headline: { "en-US": "Three" }, required: false }],
          },
        ],
      });

    const baseline = threeBlocks();
    const shifted = threeBlocks();
    [shifted.blocks[1], shifted.blocks[2]] = [shifted.blocks[2], shifted.blocks[1]];

    // The same violation exists on both sides, at different indices.
    expect(getV3SurveyPrecedenceInvalidParams(refInput(baseline))).toHaveLength(1);
    expect(getV3SurveyPrecedenceInvalidParams(refInput(shifted))).toHaveLength(1);
    // Empty only because the violation key carries no array index.
    expect(getV3SurveyIntroducedPrecedenceInvalidParams(refInput(baseline), refInput(shifted))).toEqual([]);

    const newlyBroken = withHeadline(0, "Hi #recall:second_q/fallback:x#");
    expect(
      getV3SurveyIntroducedPrecedenceInvalidParams(refInput(twoBlockSurvey()), refInput(newlyBroken))
    ).toEqual([expect.objectContaining({ code: "misordered_reference", identifier: "second_q" })]);
  });
});
