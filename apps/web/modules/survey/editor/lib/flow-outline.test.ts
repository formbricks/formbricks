import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TFlowOutline, buildFlowOutline } from "./flow-outline";

const allRuleRows = (outline: TFlowOutline) => [
  ...outline.start.rules,
  ...outline.blocks.flatMap((block) => block.rules),
];

/**
 * The fixture with extra keys merged in — constructs the survey type does not know yet, written the
 * way an API client would send them, so the draft is untyped on purpose.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- an untyped draft, see above
type TUntypedDraft = Record<string, any>;
const withUnknown = (patch: (survey: TUntypedDraft) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture) as unknown as TUntypedDraft;
  patch(survey);
  return survey as unknown as TSurvey;
};

describe("buildFlowOutline: every construct in the fixture survey", () => {
  const outline = buildFlowOutline(surveyFlowFixture);

  test("lists the blocks in survey order, each with its questions in order", () => {
    expect(outline.blocks.map((block) => block.id)).toEqual(
      surveyFlowFixture.blocks.map((block) => block.id)
    );
    expect(outline.blocks[4].elements.map((element) => element.id)).toEqual([
      "fav",
      "apple_reason",
      "bundle",
      "email",
    ]);
  });

  test("puts every rule under the block it belongs to, in order", () => {
    for (const [blockIdx, block] of surveyFlowFixture.blocks.entries()) {
      expect(outline.blocks[blockIdx].rules.map((row) => row.id)).toEqual(
        (block.logic ?? []).map((rule) => rule.id)
      );
    }
    expect(outline.blocks[4].rules.map((row) => row.ruleIdx)).toEqual([0, 1, 2, 3]);
  });

  test("shows the fallback of a block with rules, pointing at its target", () => {
    const overall = outline.blocks[4];
    expect(overall.fallback).toEqual({
      blockId: ids.blocks.overall,
      blockIdx: 4,
      target: { kind: "ending", id: ids.endings.thanks },
    });

    // No fallback set: the rest go on to the next block, which is still shown.
    expect(outline.blocks[0].fallback?.target).toEqual({ kind: "nextBlock" });
  });

  test("lists the endings last, with their type and a redirect's URL", () => {
    expect(outline.endings).toEqual([
      { id: ids.endings.thanks, endingIdx: 0, type: "endScreen" },
      { id: ids.endings.noBundle, endingIdx: 1, type: "endScreen" },
      { id: ids.endings.notForYou, endingIdx: 2, type: "endScreen" },
      { id: ids.endings.internal, endingIdx: 3, type: "redirectToUrl", url: "https://example.com/internal" },
    ]);
  });

  test("counts blocks, endings and each block's questions and rules", () => {
    expect(outline.counts).toEqual({ blocks: 6, endings: 4 });
    expect(outline.blocks.map((block) => [block.elementCount, block.ruleCount])).toEqual([
      [1, 2],
      [2, 1],
      [1, 2],
      [1, 3],
      [4, 4],
      [12, 1],
    ]);
  });

  test("a Mark as low quality rule is an editable rule of its block (ENG-6933)", () => {
    const heavyUsers = outline.blocks[2];
    const row = heavyUsers.rules.find((item) => item.id === ids.lowQuality.rule);

    expect(row).toMatchObject({
      owner: { type: "block", blockId: ids.blocks.heavyUsers, blockIdx: 2 },
      ruleIdx: 1,
      tone: "rule",
      editable: true,
    });
    expect(row?.rule.actions).toEqual([{ id: ids.lowQuality.action, objective: "markLowQuality" }]);
  });

  test("everything the survey holds is editable, and nothing is read-only", () => {
    expect(allRuleRows(outline).every((row) => row.editable)).toBe(true);
    const badges = outline.blocks.flatMap((block) => [
      ...block.badges,
      ...block.elements.flatMap((element) => element.badges),
    ]);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((badge) => badge.editable)).toBe(true);
  });

  test("a block's show-if and a question's show-if come out as editable badges (ENG-6931)", () => {
    const heavyUsers = surveyFlowFixture.blocks[2];
    const appleReason = surveyFlowFixture.blocks[4].elements[1];

    expect(outline.blocks[2].badges).toEqual([
      { kind: "showIf", conditions: heavyUsers.showIf, editable: true },
    ]);
    expect(outline.blocks[4].elements[1].badges).toEqual([
      { kind: "showIf", conditions: appleReason.showIf, editable: true },
    ]);
    expect(outline.blocks[4].elements[0].badges).toEqual([]);
  });
});

describe("buildFlowOutline: how rules read", () => {
  const outline = buildFlowOutline(surveyFlowFixture);

  test("a rule whose actions are all calculations is an Embedded Data step; any jump or require makes it a rule", () => {
    const tones = outline.blocks.map((block) => block.rules.map((row) => row.tone));

    expect(tones[0]).toEqual(["rule", "embeddedData"]);
    expect(tones[3]).toEqual(["embeddedData", "embeddedData", "embeddedData"]);
    // Two calculations and a jump.
    expect(tones[4][3]).toBe("rule");
  });

  test("each rule row names its block", () => {
    expect(outline.blocks[2].rules[0].owner).toEqual({
      type: "block",
      blockId: ids.blocks.heavyUsers,
      blockIdx: 2,
    });
  });

  test("a fallback pointing at a deleted destination is still shown, as missing", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks[1].logicFallback = "deletedblock000000000001";

    expect(buildFlowOutline(survey).blocks[1].fallback?.target).toEqual({
      kind: "missing",
      id: "deletedblock000000000001",
    });
  });

  test("a block without rules or fallback has no fallback row", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks[1].logic = [];

    expect(buildFlowOutline(survey).blocks[1].fallback).toBeNull();
  });
});

describe("buildFlowOutline: constructs the Flow tab cannot edit yet come out read-only", () => {
  const showIf = {
    id: "showifgroup0000000000001",
    connector: "and",
    conditions: [
      {
        id: "showifcond00000000000001",
        leftOperand: { type: "element", value: "services" },
        operator: "includesOneOf",
        rightOperand: { type: "static", value: ["netflix"] },
      },
    ],
  };

  test("a rule action the editor doesn't know", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[2].logic[0].actions.push({ id: "unknownaction00000000001", objective: "setOutcome" });
    });
    const row = buildFlowOutline(survey).blocks[2].rules[0];

    expect(row).toMatchObject({ editable: false, readOnlyReason: "unsupportedAction", tone: "rule" });
  });

  test("a calculation from a value type the editor doesn't know", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[3].logic[0].actions[0].value = {
        type: "expression",
        value: { type: "call", fn: "abs", args: [{ type: "element", value: "concept" }] },
      };
    });
    const row = buildFlowOutline(survey).blocks[3].rules[0];

    expect(row).toMatchObject({ editable: false, readOnlyReason: "unsupportedValue", tone: "embeddedData" });
  });

  test("a condition on an operand type the editor doesn't know", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[0].logic[1].conditions.conditions.push({
        id: "unknownoperand0000000001",
        leftOperand: { type: "contactAttribute", value: "plan" },
        operator: "isSet",
      });
    });

    expect(buildFlowOutline(survey).blocks[0].rules[1]).toMatchObject({
      editable: false,
      readOnlyReason: "unsupportedCondition",
    });
  });

  test("rules before the first question get their own section, editable (ENG-6932)", () => {
    const { start } = buildFlowOutline(surveyFlowFixture);
    const startLogic = surveyFlowFixture.startLogic ?? [];

    expect(start.rules.map((row) => [row.id, row.owner, row.ruleIdx, row.editable])).toEqual(
      startLogic.map((rule, ruleIdx) => [rule.id, { type: "start" }, ruleIdx, true])
    );
    // A screen-out is a rule; a Set value step on its own is an Embedded Data step.
    expect(start.rules.map((row) => row.tone)).toEqual(["rule", "rule", "embeddedData"]);
  });

  test("the section is there, empty, when the survey has no rules before the first question", () => {
    const survey = withUnknown((draft) => {
      delete draft.startLogic;
    });

    expect(buildFlowOutline(survey).start).toEqual({ rules: [] });
    expect(buildFlowOutline({ ...surveyFlowFixture, startLogic: null }).start).toEqual({ rules: [] });
  });

  test("a rule before the first question that the editor can't offer there is read-only", () => {
    const survey = withUnknown((draft) => {
      const [first, second, third] = draft.startLogic;
      first.actions = [{ id: "startaction0000000000009", objective: "requireAnswer", target: "fav" }];
      second.conditions.conditions[0].leftOperand = { type: "element", value: "services" };
      third.actions.push({ id: "startaction0000000000010", objective: "markLowQuality" });
    });
    const { start } = buildFlowOutline(survey);

    expect(start.rules.map((row) => [row.editable, row.readOnlyReason])).toEqual([
      [false, "unsupportedAction"],
      [false, "unsupportedCondition"],
      [false, "unsupportedAction"],
    ]);
  });

  test("a show-if on an operand type the editor doesn't know", () => {
    const unknownShowIf = {
      ...showIf,
      conditions: [
        {
          id: "unknownoperand0000000002",
          leftOperand: { type: "contactAttribute", value: "plan" },
          operator: "isSet",
        },
      ],
    };
    const survey = withUnknown((draft) => {
      draft.blocks[1].showIf = unknownShowIf;
      draft.blocks[1].elements[1].showIf = unknownShowIf;
    });
    const outline = buildFlowOutline(survey);

    expect(outline.blocks[1].badges).toEqual([
      { kind: "showIf", conditions: unknownShowIf, editable: false },
    ]);
    expect(outline.blocks[1].elements[1].badges).toEqual([
      { kind: "showIf", conditions: unknownShowIf, editable: false },
    ]);
  });

  test("option show-if, hidden options, matrix rows and columns, and copied options", () => {
    const survey = withUnknown((draft) => {
      const fav = draft.blocks[4].elements[0];
      fav.optionsCopiedFrom = "services";
      fav.choices[0].showIf = showIf;
      fav.choices[1].showIf = showIf;
      // Hidden wins over show-if: counted once, as hidden.
      fav.choices[2].showIf = showIf;
      fav.choices[2].hidden = true;

      const grid = draft.blocks[5].elements[2];
      grid.rows[0].showIf = showIf;
      grid.columns[1].hidden = true;
    });
    const outline = buildFlowOutline(survey);

    expect(outline.blocks[4].elements[0].badges).toEqual([
      { kind: "optionsCopiedFrom", sourceId: "services", editable: false },
      { kind: "optionsShowIf", count: 2, editable: false },
      { kind: "hiddenOptions", count: 1, editable: false },
    ]);
    expect(outline.blocks[5].elements[2].badges).toEqual([
      { kind: "optionsShowIf", count: 1, editable: false },
      { kind: "hiddenOptions", count: 1, editable: false },
    ]);
  });
});
