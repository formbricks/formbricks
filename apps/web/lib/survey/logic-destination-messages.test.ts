import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { mockSurveyWithLogic } from "@/lib/survey/__mock__/survey.mock";

/**
 * A jump or fallback whose destination block was deleted used to be reported as
 * `Block ID <cuid> does not exist in logic no: 1 of block 1` — an internal id, shown in the editor
 * toast. The owning block's title and the rule number identify it instead (ENG-3443).
 *
 * The fixture is neutralised the same way `reserved-logic-operands.test.ts` does it, so that the
 * only failing refinement is the one under test.
 */
describe("a logic rule whose destination block no longer exists", () => {
  const deletedBlockId = "clzz0000000000000000deleted";

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

  const jumpRule = (target: string) =>
    ({
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
      actions: [{ id: "cd0000000000000000000004", objective: "jumpToBlock", target }],
    }) as unknown as TSurveyBlockLogic;

  const surveyWith = (firstBlock: Record<string, unknown>) =>
    ({
      ...mockSurveyWithLogic,
      languages: [],
      endings: [],
      followUps: [],
      blocks: [{ ...mockSurveyWithLogic.blocks[0], logicFallback: undefined, ...firstBlock }, secondBlock],
    }) as unknown as Record<string, unknown>;

  const issuesOf = (survey: Record<string, unknown>) => {
    const result = ZSurvey.safeParse(survey);
    expect(result.success).toBe(false);
    return result.success ? [] : result.error.issues;
  };

  test("a jump names the rule and the owning block's title, not the missing id", () => {
    const issues = issuesOf(surveyWith({ name: "Intro questions", logic: [jumpRule(deletedBlockId)] }));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      'Conditional Logic: Jump destination in rule 1 of "Intro questions" no longer exists. Choose a valid destination.'
    );
    expect(issues[0].message).not.toContain(deletedBlockId);
    expect(issues[0].path).toEqual(["blocks", 0, "logic", 0]);
    expect((issues[0] as { params?: unknown }).params).toEqual({ missingLogicDestination: "jump" });
  });

  test("a fallback names the owning block's title, not the missing id", () => {
    const issues = issuesOf(
      surveyWith({ name: "Intro questions", logic: [jumpRule("block2")], logicFallback: deletedBlockId })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      'Conditional Logic: Fallback destination of "Intro questions" no longer exists. Choose a valid destination.'
    );
    expect(issues[0].message).not.toContain(deletedBlockId);
    expect((issues[0] as { params?: unknown }).params).toEqual({ missingLogicDestination: "fallback" });
  });
});
