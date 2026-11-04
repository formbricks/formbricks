import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic, TSurveyBlockLogicAction } from "./blocks";
import type { TSingleCondition } from "./logic";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { MAX_START_LOGIC_RULES, type TSurvey, ZSurvey } from "./types";

/**
 * Rules before the first question (ENG-6932, json-shapes.md section 4). They run before any answer
 * exists, so they may only jump (to a block, or to an ending as a screen-out) and set a value, and
 * read fields, never answers. Every refusal names the exact path of what is wrong.
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;

const condition = (overrides: Partial<TSingleCondition> = {}): TSingleCondition => ({
  id: "startcond000000000000001",
  leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
  operator: "isSet",
  ...overrides,
});

const rule = (
  actions: TSurveyBlockLogicAction[],
  conditions: TSingleCondition[] = [condition()]
): TSurveyBlockLogic => ({
  id: "startrule000000000000001",
  conditions: { id: "startgroup00000000000001", connector: "and", conditions },
  actions,
});

const jump = (target: string): TSurveyBlockLogicAction => ({
  id: "startaction0000000000001",
  objective: "jumpToBlock",
  target,
});

const withStartLogic = (startLogic: TSurveyBlockLogic[] | null | undefined): TSurvey => ({
  ...surveyFlowFixture,
  startLogic,
});

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({ path, message }));

/** Every issue at its exact path, each message naming what is wrong (`""` matches any message). */
const expectIssues = (issues: ReturnType<typeof issuesOf>, expected: [PropertyKey[], string][]) => {
  expect(issues.map((issue) => issue.path)).toEqual(expected.map(([path]) => path));
  issues.forEach((issue, idx) => expect(issue.message).toContain(expected[idx][1]));
};

describe("rules before the first question", () => {
  test("the fixture's start logic is valid", () => {
    expect(surveyFlowFixture.startLogic?.length).toBeGreaterThan(0);
    expect(issuesOf(surveyFlowFixture)).toEqual([]);
  });

  test("a survey without start logic stays valid, whether the key is missing or null", () => {
    const { startLogic: _removed, ...withoutKey } = surveyFlowFixture;

    expect(issuesOf(withoutKey as TSurvey)).toEqual([]);
    expect(issuesOf(withStartLogic(null))).toEqual([]);
    expect(issuesOf(withStartLogic([]))).toEqual([]);
  });

  test("a jump may go to any block, including the first, or to an ending", () => {
    for (const target of [ids.blocks.services, ids.blocks.profile, ids.endings.internal]) {
      expect(issuesOf(withStartLogic([rule([jump(target)])]))).toEqual([]);
    }
  });

  test("refuses requireAnswer with the exact path of the action", () => {
    const issues = issuesOf(
      withStartLogic([
        rule([
          jump(ids.blocks.ratings),
          { id: "startaction0000000000002", objective: "requireAnswer", target: "apple_reason" },
        ]),
      ])
    );

    expectIssues(issues, [[["startLogic", 0, "actions", 1], "before the first question"]]);
  });

  test("refuses Mark as low quality with the exact path of the action (ENG-6933)", () => {
    const issues = issuesOf(
      withStartLogic([
        rule([jump(ids.blocks.ratings), { id: "startaction0000000000002", objective: "markLowQuality" }]),
      ])
    );

    expectIssues(issues, [[["startLogic", 0, "actions", 1], "can't mark the response Low quality"]]);
  });

  test("refuses a jump to a block or ending that does not exist", () => {
    expectIssues(issuesOf(withStartLogic([rule([jump("missingblock000000000001")])])), [
      [["startLogic", 0, "actions", 0, "target"], "no longer exists"],
    ]);
  });

  test("refuses two jumps in one rule", () => {
    const issues = issuesOf(
      withStartLogic([
        rule([jump(ids.blocks.ratings), { ...jump(ids.endings.thanks), id: "startaction0000000000002" }]),
      ])
    );

    expectIssues(issues, [[["startLogic", 0, "actions"], ""]]);
  });

  test("refuses an answer in a condition, on the left or on the right", () => {
    const left = issuesOf(
      withStartLogic([
        rule(
          [jump(ids.blocks.ratings)],
          [condition({ leftOperand: { type: "element", value: "services" }, operator: "isSubmitted" })]
        ),
      ])
    );
    const right = issuesOf(
      withStartLogic([
        rule(
          [jump(ids.blocks.ratings)],
          [
            condition(),
            condition({
              id: "startcond000000000000002",
              operator: "equals",
              rightOperand: { type: "element", value: "overall" },
            }),
          ]
        ),
      ])
    );

    expectIssues(left, [[["startLogic", 0, "conditions"], "answer"]]);
    expectIssues(right, [[["startLogic", 0, "conditions"], "answer"]]);
  });

  test("refuses a hidden field or computed field that does not exist", () => {
    const issues = issuesOf(
      withStartLogic([
        rule(
          [jump(ids.blocks.ratings)],
          [
            condition({ leftOperand: { type: "hiddenField", value: "nope" } }),
            condition({
              id: "startcond000000000000002",
              leftOperand: { type: "variable", value: "missingvariable000000001" },
            }),
          ]
        ),
      ])
    );

    expectIssues(issues, [
      [["startLogic", 0, "conditions"], "nope"],
      [["startLogic", 0, "conditions"], "missingvariable000000001"],
    ]);
  });

  test("a Set value must name an existing computed field and may not read an answer", () => {
    const issues = issuesOf(
      withStartLogic([
        rule([
          {
            id: "startaction0000000000001",
            objective: "calculate",
            variableId: "missingvariable000000001",
            operator: "assign",
            value: { type: "static", value: 1 },
          },
          {
            id: "startaction0000000000002",
            objective: "calculate",
            variableId: ids.variables.score,
            operator: "assign",
            value: { type: "element", value: "overall" },
          },
        ]),
      ])
    );

    expectIssues(issues, [
      [["startLogic", 0, "actions", 0, "variableId"], ""],
      [["startLogic", 0, "actions", 1, "value"], "answer"],
    ]);
  });

  test("a Set value from a hidden field must name one the survey declares", () => {
    const setSegmentFrom = (fieldId: string): TSurveyBlockLogicAction => ({
      id: "startaction0000000000001",
      objective: "calculate",
      variableId: ids.variables.segment,
      operator: "assign",
      value: { type: "hiddenField", value: fieldId },
    });

    expectIssues(issuesOf(withStartLogic([rule([setSegmentFrom("nope")])])), [
      [["startLogic", 0, "actions", 0, "value"], "Hidden field ID nope does not exist"],
    ]);
    expect(issuesOf(withStartLogic([rule([setSegmentFrom(ids.hiddenFields.seg)])]))).toEqual([]);
  });

  test("a hostile formula thousands of levels deep is refused once, at its path, and never walked", () => {
    // An answer at the bottom: walking the tree would also report it, if the walk survived 20,000 levels.
    let tree: unknown = { type: "element", value: "overall" };
    for (let level = 0; level < 20_000; level++) tree = { type: "call", fn: "abs", args: [tree] };
    const hostile = {
      id: "startaction0000000000001",
      objective: "calculate",
      variableId: ids.variables.score,
      operator: "assign",
      value: { type: "expression", value: tree },
    } as TSurveyBlockLogicAction;

    const issues = issuesOf(withStartLogic([rule([hostile])]));

    expect(issues).toHaveLength(1);
    expect(issues[0].path.slice(0, 6)).toEqual(["startLogic", 0, "actions", 0, "value", "value"]);
    expect(issues[0].message).toContain("nested deeper than");
  });

  test("holds at most MAX_START_LOGIC_RULES rules, on every write path (the shared schema)", () => {
    const rules = (count: number) =>
      Array.from({ length: count }, (_unused, idx) => ({
        ...rule([jump(ids.blocks.concept)]),
        id: `startrule${String(idx).padStart(15, "0")}`,
      }));

    expect(issuesOf(withStartLogic(rules(MAX_START_LOGIC_RULES)))).toEqual([]);
    expect(issuesOf(withStartLogic(rules(MAX_START_LOGIC_RULES + 1))).map((issue) => issue.path)).toEqual([
      ["startLogic"],
    ]);
  });

  test("a condition may read a computed date (P38), which only the typed fields declare", () => {
    expect(surveyFlowFixture.variables.some((variable) => variable.id === ids.variables.signedUpAt)).toBe(
      false
    );
    expect(
      issuesOf(
        withStartLogic([
          rule(
            [jump(ids.blocks.concept)],
            [
              condition({
                leftOperand: { type: "variable", value: ids.variables.signedUpAt },
                operator: "isAfter",
                rightOperand: { type: "static", value: "2026-01-01" },
              }),
            ]
          ),
        ])
      )
    ).toEqual([]);
  });

  test("a Set value formula (ENG-6935) may set a computed date and read fields, but not an answer", () => {
    const setValue = (id: string, variableId: string, value: unknown) =>
      ({
        id,
        objective: "calculate",
        variableId,
        operator: "assign",
        value: { type: "expression", value },
      }) as TSurveyBlockLogicAction;

    expect(
      issuesOf(
        withStartLogic([
          rule([
            setValue("startaction0000000000001", ids.variables.signedUpAt, {
              type: "call",
              fn: "now",
              args: [],
            }),
            setValue("startaction0000000000002", ids.variables.tenureDays, {
              type: "call",
              fn: "daysBetween",
              args: [
                { type: "hiddenField", value: ids.hiddenFields.signupDate },
                { type: "variable", value: ids.variables.signedUpAt },
              ],
            }),
          ]),
        ])
      )
    ).toEqual([]);

    expectIssues(
      issuesOf(
        withStartLogic([
          rule([
            setValue("startaction0000000000001", ids.variables.score, {
              type: "call",
              fn: "add",
              args: [
                { type: "static", value: 1 },
                { type: "element", value: "overall" },
              ],
            }),
            setValue("startaction0000000000002", ids.variables.score, { type: "call", fn: "now", args: [] }),
          ]),
        ])
      ),
      [
        [["startLogic", 0, "actions", 0, "value", "value", "args", 1, "value"], "answer"],
        [["startLogic", 0, "actions", 1, "value", "value"], "the result is date"],
      ]
    );
  });
});
