import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { mockSurveyWithLogic } from "@/lib/survey/__mock__/survey.mock";

/**
 * A Signature element is a survey element like any other: it saves, defaults `allowTypedSignature` to
 * on, and its logic allows "is signed" / "is not signed" (`isSubmitted` / `isSkipped`) and nothing else.
 *
 * Lives in apps/web for the same reason as `reserved-logic-operands.test.ts`: the complete `TSurvey`
 * fixtures live here.
 */
describe("Signature element in a survey", () => {
  const signatureElement = {
    id: "sig1",
    type: "signature",
    headline: { default: "Sign here" },
    required: true,
  };

  const secondBlock = {
    id: "block2",
    name: "Block 2",
    elements: [
      {
        id: "q_block2",
        type: "openText",
        inputType: "text",
        headline: { default: "Anything else?" },
        required: false,
        charLimit: { enabled: false },
      },
    ],
    logic: [],
    logicFallback: undefined,
  };

  const rule = (operator: string): TSurveyBlockLogic =>
    ({
      id: "cd0000000000000000000001",
      conditions: {
        id: "cd0000000000000000000002",
        connector: "and",
        conditions: [
          {
            id: "cd0000000000000000000003",
            leftOperand: { type: "element", value: "sig1" },
            operator,
          },
        ],
      },
      actions: [{ id: "cd0000000000000000000004", objective: "jumpToBlock", target: "block2" }],
    }) as unknown as TSurveyBlockLogic;

  const survey = (logic: TSurveyBlockLogic[], required = true) =>
    ({
      ...mockSurveyWithLogic,
      languages: [],
      endings: [],
      followUps: [],
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [{ ...signatureElement, required }],
          logic,
          logicFallback: undefined,
        },
        secondBlock,
      ],
    }) as unknown as Record<string, unknown>;

  test("saves, and allowTypedSignature defaults to true", () => {
    const result = ZSurvey.safeParse(survey([]));

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data?.blocks[0].elements[0]).toMatchObject({
      type: "signature",
      allowTypedSignature: true,
    });
  });

  test("keeps allowTypedSignature when it is switched off", () => {
    const withoutTyping = survey([]);
    (withoutTyping.blocks as { elements: unknown[] }[])[0].elements = [
      { ...signatureElement, allowTypedSignature: false },
    ];

    const result = ZSurvey.safeParse(withoutTyping);

    expect(result.data?.blocks[0].elements[0]).toMatchObject({ allowTypedSignature: false });
  });

  // "Is not signed" needs an optional element: a required one can never be skipped, so the shared
  // required-element rule refuses `isSkipped` for every element type.
  test.each(["isSubmitted", "isSkipped"])(
    "allows the %s logic operator on an optional Signature",
    (operator) => {
      const result = ZSurvey.safeParse(survey([rule(operator)], false));

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  );

  test("allows is signed on a required Signature and refuses is not signed", () => {
    expect(ZSurvey.safeParse(survey([rule("isSubmitted")])).success).toBe(true);
    expect(ZSurvey.safeParse(survey([rule("isSkipped")])).success).toBe(false);
  });

  test.each(["equals", "doesNotEqual", "contains", "isSet"])("refuses the %s logic operator", (operator) => {
    const result = ZSurvey.safeParse(survey([rule(operator)]));

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues ?? [])).toContain(
      `Invalid operator \\"${operator}\\" for element type \\"signature\\"`
    );
  });
});
