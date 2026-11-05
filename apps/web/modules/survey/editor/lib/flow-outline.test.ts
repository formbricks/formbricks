import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TFlowOutline, buildFlowOutline, getElementShowIfCells } from "./flow-outline";

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
      [2, 2],
      [1, 3],
      [1, 3],
      [4, 4],
      [14, 2],
    ]);
  });

  test("a Mark as low quality rule is an editable rule of its block (ENG-6933)", () => {
    const heavyUsers = outline.blocks[2];
    const row = heavyUsers.rules.find((item) => item.id === ids.lowQuality.rule);

    expect(row).toMatchObject({
      owner: { type: "block", blockId: ids.blocks.heavyUsers, blockIdx: 2 },
      ruleIdx: 1,
      type: "markLowQuality",
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
    expect(outline.blocks[4].elements[3].badges).toEqual([]);
  });

  test("a question with copied options gets no badge for the copy, only its options' show-if (P70)", () => {
    expect(outline.blocks[5].elements[12].badges).toEqual([
      { kind: "optionsShowIf", count: 4, editable: true },
    ]);
  });
});

describe("buildFlowOutline: how rules read", () => {
  const outline = buildFlowOutline(surveyFlowFixture);

  test("each rule reads as one type, the type of its action: jump, Set value, Require answer, Low quality", () => {
    const types = outline.blocks.map((block) => block.rules.map((row) => row.type));

    expect(types[0]).toEqual(["requireAnswer", "setValue"]);
    expect(types[2]).toEqual(["setValue", "markLowQuality", "setValue"]);
    expect(types[4].slice(0, 3)).toEqual(["setValue", "jump", "jump"]);
  });

  test("a rule with several kinds of action reads as its first action's type", () => {
    // Two calculations and a jump.
    expect(outline.blocks[4].rules[3].type).toBe("setValue");

    const survey = structuredClone(surveyFlowFixture);
    const rule = survey.blocks[4].logic?.[3];
    if (!rule) throw new Error("fixture rule missing");
    rule.actions = [...rule.actions].reverse();
    expect(buildFlowOutline(survey).blocks[4].rules[3].type).toBe("jump");
  });

  test("an action the editor doesn't know is passed over for the type of the next one", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[2].logic[1].actions.unshift({ id: "unknownaction00000000002", objective: "setOutcome" });
    });

    expect(buildFlowOutline(survey).blocks[2].rules[1].type).toBe("markLowQuality");
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

    expect(row).toMatchObject({ editable: false, readOnlyReason: "unsupportedAction", type: "setValue" });
  });

  test("a calculation from a value type the editor doesn't know", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[3].logic[0].actions[0].value = { type: "lookup", value: "concept" };
    });
    const row = buildFlowOutline(survey).blocks[3].rules[0];

    expect(row).toMatchObject({ editable: false, readOnlyReason: "unsupportedValue", type: "setValue" });
  });

  test("a Set value expression is editable (ENG-6935)", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[3].logic[0].actions[0].value = {
        type: "expression",
        value: { type: "call", fn: "abs", args: [{ type: "element", value: "concept" }] },
      };
    });
    const row = buildFlowOutline(survey).blocks[3].rules[0];

    expect(row).toMatchObject({ editable: true, type: "setValue" });
    expect(row.readOnlyReason).toBeUndefined();
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
    // A screen-out is a jump; a rule that sets a value before it jumps reads as its first action.
    expect(start.rules.map((row) => row.type)).toEqual(["jump", "setValue", "setValue"]);
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

  test("option show-if, hidden options, matrix rows and columns", () => {
    const survey = withUnknown((draft) => {
      const fav = draft.blocks[4].elements[0];
      fav.optionsCopiedFrom = "services";
      // The fixture's fourth option already has a show-if.
      fav.choices[0].showIf = showIf;
      fav.choices[1].showIf = showIf;
      // Hidden wins over show-if: counted once, as hidden.
      fav.choices[2].showIf = showIf;
      fav.choices[2].hidden = true;

      // The fixture's second row has a show-if.
      const grid = draft.blocks[5].elements[2];
      grid.rows[0].showIf = showIf;
      grid.columns[1].hidden = true;
    });
    const outline = buildFlowOutline(survey);

    // ENG-6937: option show-if and Hidden are edited in the "Options shown if" popover.
    expect(outline.blocks[4].elements[0].badges).toEqual([
      { kind: "optionsShowIf", count: 3, editable: true },
      { kind: "hiddenOptions", count: 1, editable: true },
    ]);
    expect(outline.blocks[5].elements[2].badges).toEqual([
      { kind: "optionsShowIf", count: 2, editable: true },
      { kind: "hiddenOptions", count: 1, editable: true },
    ]);
  });

  test("an option show-if on an operand type the editor doesn't know makes the options badge read-only", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[4].elements[0].choices[0].showIf = {
        ...showIf,
        conditions: [
          {
            id: "unknownoperand0000000003",
            leftOperand: { type: "contactAttribute", value: "plan" },
            operator: "isSet",
          },
        ],
      };
    });

    expect(buildFlowOutline(survey).blocks[4].elements[0].badges).toEqual([
      { kind: "optionsShowIf", count: 2, editable: false },
    ]);
  });

  test("questions with options say which lists the popover edits", () => {
    const outline = buildFlowOutline(surveyFlowFixture);
    const listsOf = (elementId: string) =>
      outline.blocks.flatMap((block) => block.elements).find((element) => element.id === elementId)
        ?.optionLists;

    expect(listsOf("services")).toEqual(["choices"]);
    expect(listsOf("brand_rank")).toEqual(["choices"]);
    expect(listsOf("ad_pick")).toEqual(["choices"]);
    expect(listsOf("brand_grid")).toEqual(["rows", "columns"]);
    expect(listsOf("hours")).toEqual([]);
  });
});

describe("getElementShowIfCells: a question's show-if columns (ENG-6969 T8, T10)", () => {
  const outline = buildFlowOutline(surveyFlowFixture);
  const item = (elementId: string) => {
    const found = outline.blocks
      .flatMap((block) => block.elements)
      .find((element) => element.id === elementId);
    if (!found) throw new Error(`no question ${elementId}`);
    return found;
  };
  const levels = (elementId: string, canAdd = true) =>
    getElementShowIfCells(item(elementId), canAdd).map((cell) => `${cell.level}:${cell.state}`);

  test("the question's cell always comes before its options' cell, set or not", () => {
    // Nothing set on the question, options set.
    expect(levels("fav")).toEqual(["question:add", "options:set"]);
    // The question set, its options not.
    const appleReason = structuredClone(surveyFlowFixture);
    const overall = appleReason.blocks[4];
    overall.elements[0] = { ...overall.elements[0], showIf: overall.elements[1].showIf };
    const favSet = buildFlowOutline(appleReason).blocks[4].elements[0];
    expect(getElementShowIfCells(favSet, true).map((cell) => `${cell.level}:${cell.state}`)).toEqual([
      "question:set",
      "options:set",
    ]);
    // Neither set.
    expect(levels("services")).toEqual(["question:add", "options:add"]);
  });

  test("a set question show-if carries its conditions, and whether it can be edited here", () => {
    const appleReason = surveyFlowFixture.blocks[4].elements[1];
    expect(getElementShowIfCells(item("apple_reason"), true)[0]).toEqual({
      level: "question",
      state: "set",
      conditions: appleReason.showIf,
      editable: true,
    });
  });

  test("a question with nothing before it to read offers no question show-if", () => {
    expect(levels("services", false)).toEqual(["question:none", "options:add"]);
  });

  test("the options cell counts conditional and Hidden options, and stays empty without options", () => {
    expect(getElementShowIfCells(item("fav"), true)[1]).toEqual({
      level: "options",
      state: "set",
      showIfCount: 1,
      hiddenCount: 0,
      editable: true,
    });
    expect(getElementShowIfCells(item("bundle"), true)[1]).toEqual({
      level: "options",
      state: "set",
      showIfCount: 0,
      hiddenCount: 1,
      editable: true,
    });
    expect(levels("email")).toEqual(["question:add", "options:none"]);
  });

  test("an options show-if the editor can't show is read-only", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[4].elements[0].choices[0].showIf = {
        id: "unknowngroup000000000001",
        connector: "and",
        conditions: [
          {
            id: "unknownoperand0000000009",
            leftOperand: { type: "contactAttribute", value: "plan" },
            operator: "isSet",
          },
        ],
      };
    });
    const [, options] = getElementShowIfCells(buildFlowOutline(survey).blocks[4].elements[0], true);
    expect(options).toMatchObject({ level: "options", state: "set", editable: false });
  });
});
