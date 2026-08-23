import { mockSurvey } from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { mockSurveyWithLogic } from "@/lib/survey/__mock__/survey.mock";

/**
 * ENG-2538, bug 2: a logic condition on a reserved field made the survey unsaveable.
 *
 * ENG-1840 added `reserved` as a fourth member of `ZDynamicLogicFieldValue`, but both left-operand
 * validators in `packages/types/surveys/types.ts` ended their chain with a bare `else` commented
 * `leftOperand.type === "hiddenField"`. The new member fell into it, was looked up in
 * `survey.hiddenFields.fieldIds` and reported missing — so every one of the 16 reserved fields the
 * picker offers produced `Conditional Logic: Hidden field ID <name> does not exist`, and the "usable
 * in logic" half of ENG-1840 did not work at all.
 *
 * Red on main: `pnpm --filter=@formbricks/web test lib/survey/reserved-logic-operands.test.ts`.
 *
 * These live in apps/web rather than packages/types for the same reason as
 * `legacy-field-names.test.ts` — packages/types cannot import from apps/web, and the complete
 * `TSurvey` fixtures live here.
 */
describe("a logic condition on a reserved field saves", () => {
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

  /**
   * `mockSurveyWithLogic` declares a `de` language its fixture headlines do not carry, and its
   * follow-ups are validated against elements derived from `blocks`. Both fail refinements that have
   * nothing to do with logic operands, so they are neutralised here to isolate what this file is
   * about — the same reason `legacy-field-names.test.ts` drops `followUps`. A second block exists so
   * the jump target is not the block carrying the rule, which is its own refinement.
   */
  const withBlockLogic = (logic: TSurveyBlockLogic[]) =>
    ({
      ...mockSurveyWithLogic,
      languages: [],
      endings: [],
      followUps: [],
      blocks: [{ ...mockSurveyWithLogic.blocks[0], logic, logicFallback: undefined }, secondBlock],
    }) as unknown as Record<string, unknown>;

  const reservedRule = (name: string) =>
    ({
      id: "cd0000000000000000000001",
      conditions: {
        id: "cd0000000000000000000002",
        connector: "and",
        conditions: [
          {
            id: "cd0000000000000000000003",
            leftOperand: { type: "reserved", value: name },
            operator: "isSet",
          },
        ],
      },
      actions: [{ id: "cd0000000000000000000004", objective: "jumpToBlock", target: "block2" }],
    }) as unknown as TSurveyBlockLogic;

  test("BLOCKS path: a reserved left operand is not reported as a missing hidden field", () => {
    const result = ZSurvey.safeParse(withBlockLogic([reservedRule("timezone")]));

    // Asserted on the message as well as on `success`, so an unrelated refinement failing in this
    // fixture cannot make the test pass for the wrong reason.
    expect(JSON.stringify(result.error?.issues ?? [])).not.toContain("Hidden field ID timezone");
    expect(result.success).toBe(true);
  });

  test("BLOCKS path: every reserved name the picker can offer saves", () => {
    // Names, not the catalog itself: the point is that the validator does not consult the catalog at
    // all (`ZDynamicReservedField` checks non-empty only, so a survey authored against a newer
    // catalog still parses on an older deployment). A name absent from today's catalog must save for
    // exactly the same reason, which is what the last entry pins.
    for (const name of ["url", "source", "action", "language", "timezone", "utmSource", "notInAnyCatalog"]) {
      const result = ZSurvey.safeParse(withBlockLogic([reservedRule(name)]));

      expect(result.success, `reserved operand "${name}"`).toBe(true);
    }
  });

  test("a hidden-field operand naming nothing the survey declares is STILL reported", () => {
    // The explicit `hiddenField` arm must keep doing its job: a fix that made the chain lenient for
    // every unmatched type would pass the tests above while silently losing this.
    const rule = {
      ...reservedRule("ignored"),
      conditions: {
        id: "cd0000000000000000000002",
        connector: "and",
        conditions: [
          {
            id: "cd0000000000000000000003",
            leftOperand: { type: "hiddenField", value: "no_such_field" },
            operator: "isSet",
          },
        ],
      },
    } as unknown as TSurveyBlockLogic;

    const result = ZSurvey.safeParse(withBlockLogic([rule]));

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues ?? [])).toContain("Hidden field ID no_such_field");
  });

  test("QUESTIONS path: the legacy validator carried the identical bug", () => {
    const questions = [...mockSurvey.questions] as Record<string, unknown>[];
    questions[0] = {
      ...questions[0],
      logic: [
        {
          id: "cd0000000000000000000001",
          conditions: {
            id: "cd0000000000000000000002",
            connector: "and",
            conditions: [
              {
                id: "cd0000000000000000000003",
                leftOperand: { type: "reserved", value: "timezone" },
                operator: "isSet",
              },
            ],
          },
          // Targets the ending, not a question: `mockSurvey` has exactly one question, so the previous
          // `questions[questions.length - 1]` target was the rule's OWN question and the survey failed
          // the cyclic-logic refinement — which the message-only assertion below could not see. The
          // legacy path has no `jumpToEnding`, but it accepts an ending id as a `jumpToQuestion`
          // target. Same reason `withBlockLogic` adds a second block.
          actions: [
            {
              id: "cd0000000000000000000004",
              objective: "jumpToQuestion",
              target: "gt1yoaeb5a3istszxqbl08mk",
            },
          ],
        },
      ],
    };

    const result = ZSurvey.safeParse({ ...mockSurvey, followUps: [], questions });

    // Asserted on `success` too, matching the BLOCKS test above: without it an unrelated refinement
    // rejecting this fixture would leave the test green while the survey stays unsaveable.
    expect(JSON.stringify(result.error?.issues ?? [])).not.toContain("Hidden field ID timezone");
    expect(result.success).toBe(true);
  });
});
