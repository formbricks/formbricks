import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TFlowOutline, buildFlowOutline } from "./flow-outline";

const allRuleRows = (outline: TFlowOutline) => [
  ...(outline.start?.rules ?? []),
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
      [1, 1],
      [1, 3],
      [4, 4],
      [12, 1],
    ]);
  });

  test("everything today's survey holds is editable, and nothing is read-only", () => {
    expect(allRuleRows(outline).every((row) => row.editable)).toBe(true);
    expect(outline.start).toBeNull();
    expect(outline.blocks.flatMap((block) => block.badges)).toEqual([]);
    expect(outline.blocks.flatMap((block) => block.elements.flatMap((element) => element.badges))).toEqual(
      []
    );
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
      draft.blocks[2].logic[0].actions.push({ id: "lowqualityaction00000001", objective: "markLowQuality" });
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

  test("rules before the first question get their own section", () => {
    const survey = withUnknown((draft) => {
      draft.startLogic = [
        {
          id: "startrule000000000000001",
          conditions: {
            id: "startgroup00000000000001",
            connector: "and",
            conditions: [
              {
                id: "startcond000000000000001",
                leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
                operator: "isNotSet",
              },
            ],
          },
          actions: [
            { id: "startaction0000000000001", objective: "jumpToBlock", target: ids.endings.notForYou },
          ],
        },
      ];
    });
    const { start } = buildFlowOutline(survey);

    expect(start?.rules.map((row) => [row.id, row.owner, row.editable])).toEqual([
      ["startrule000000000000001", { type: "start" }, false],
    ]);
  });

  test("show-if on a block and on a question", () => {
    const survey = withUnknown((draft) => {
      draft.blocks[2].showIf = showIf;
      draft.blocks[1].elements[1].showIf = showIf;
    });
    const outline = buildFlowOutline(survey);

    expect(outline.blocks[2].badges).toEqual([{ kind: "showIf", conditions: showIf, editable: false }]);
    expect(outline.blocks[1].elements[1].badges).toEqual([
      { kind: "showIf", conditions: showIf, editable: false },
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
