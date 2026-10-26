import { describe, expect, test } from "vitest";
import type { TShowConditionGroup, TShowConditionSingle } from "@formbricks/types/show-conditions";
import {
  type TShowConditionsContext,
  evaluateShowConditions,
} from "@formbricks/types/show-conditions-evaluate";
import {
  describeActual,
  describeCondition,
  describeConditionTree,
  describeOutcome,
  findCondition,
} from "@/debug-panel/format";
import type { TDebugSurveyEvent } from "@/types/debug";

const event = (overrides: Partial<TDebugSurveyEvent>): TDebugSurveyEvent => ({
  type: "survey",
  at: 0,
  surveyId: "s1",
  stage: "trigger",
  outcome: "shown",
  ...overrides,
});

describe("debug panel text", () => {
  test.each([
    [event({ outcome: "shown" }), "Shown"],
    [
      event({ outcome: "excluded", exclusion: "cooldown" }),
      "Not shown: inside the cooldown period after the last survey",
    ],
    [
      event({ outcome: "excluded", exclusion: "segment" }),
      "Not shown: this visitor is not in the survey's segment",
    ],
    [event({ outcome: "conditionsFailed" }), "Not shown: show conditions not met"],
    [event({ outcome: "conditionsFailed", stage: "beforeShow" }), "Not shown: show conditions no longer met"],
    [event({ outcome: "conditionsPassed", stage: "beforeShow" }), "Show conditions still met"],
    [event({ outcome: "conditionsUnreadable" }), "Not shown: its show conditions could not be read"],
    [event({ outcome: "notSampled" }), "Not shown: outside the display percentage"],
    [event({ outcome: "anotherSurveyOpen" }), "Not shown: another survey is open"],
  ])("explains %j", (input, expected) => {
    expect(describeOutcome(input)).toBe(expected);
  });

  test("describes a condition in one line, cutting long lists", () => {
    expect(
      describeCondition({
        id: "c1",
        leftOperand: { type: "page", value: "currentUrl" },
        operator: "containsAnyOf",
        rightOperand: { type: "static", value: ["/a", "/b", "/c", "/d"] },
      })
    ).toBe("Current URL contains any of /a, /b, /c (+1)");
    expect(
      describeCondition({
        id: "c2",
        leftOperand: { type: "page", value: "queryParam", meta: { key: "source" } },
        operator: "isNotSet",
      })
    ).toBe('Query parameter "source" is not set');
  });

  test("shows what the evaluator read, including nothing", () => {
    expect(describeActual(null)).toBe("no value");
    expect(describeActual([])).toBe("none");
    expect(describeActual(["/", "/plans"])).toBe("/ · /plans");
    expect(describeActual(3)).toBe("3");
  });

  test("finds a condition by id inside a group", () => {
    const conditions: TShowConditionGroup = {
      id: "root",
      connector: "and",
      conditions: [
        {
          id: "g",
          connector: "or",
          conditions: [
            { id: "deep", leftOperand: { type: "device", value: "deviceType" }, operator: "equals" },
          ],
        },
      ],
    };

    expect(findCondition(conditions, "deep")?.leftOperand.value).toBe("deviceType");
    expect(findCondition(conditions, "missing")).toBeUndefined();
    expect(findCondition(undefined, "deep")).toBeUndefined();
  });
});

describe("debug panel condition tree (ENG-4070)", () => {
  const context: TShowConditionsContext = {
    url: "https://www.example.com/plans",
    pageReferrer: "",
    visit: {
      pagesViewed: 2,
      uniquePagesViewed: 2,
      timeOnSite: 30,
      entryReferrer: "",
      visitedUrls: ["/", "/plans"],
      uniquePaths: ["/", "/plans"],
    },
    device: { deviceType: "desktop", browser: "chrome", screenWidth: 1280 },
  };
  const onPlans: TShowConditionSingle = {
    id: "url",
    leftOperand: { type: "page", value: "currentUrl" },
    operator: "pathIsAnyOf",
    rightOperand: { type: "static", value: ["/plans"] },
  };
  const onPhone: TShowConditionSingle = {
    id: "phone",
    leftOperand: { type: "device", value: "deviceType" },
    operator: "equals",
    rightOperand: { type: "static", value: "phone" },
  };
  const twoPages: TShowConditionSingle = {
    id: "pages",
    leftOperand: { type: "visit", value: "pagesViewed" },
    operator: "isGreaterThanOrEqual",
    rightOperand: { type: "static", value: 2 },
  };
  const rule = (anyOf: TShowConditionSingle[]): TShowConditionGroup => ({
    id: "root",
    connector: "and",
    conditions: [onPlans, { id: "any", connector: "or", conditions: anyOf }],
  });
  const treeOf = (conditions: TShowConditionGroup) =>
    describeConditionTree(conditions, evaluateShowConditions(conditions, context));

  test("an any-of group that passed shows ✓, even with a failing branch under it", () => {
    expect(treeOf(rule([onPhone, twoPages]))).toEqual([
      { depth: 0, passed: true, text: "All of:" },
      { depth: 1, passed: true, text: "Current URL path is any of /plans — read: /plans" },
      { depth: 1, passed: true, text: "Any of:" },
      { depth: 2, passed: false, text: "Device is phone — read: desktop" },
      { depth: 2, passed: true, text: "Pages viewed ≥ 2 — read: 2" },
    ]);
  });

  test("a failing survey points to the group that failed", () => {
    const rows = treeOf(rule([onPhone])) ?? [];

    expect(rows.filter((row) => row.text.endsWith("of:")).map(({ text, passed }) => [text, passed])).toEqual([
      ["All of:", false],
      ["Any of:", false],
    ]);
  });

  test("an event from an SDK without group outcomes keeps the flat list", () => {
    const conditions = rule([onPhone]);
    const { results } = evaluateShowConditions(conditions, context);

    expect(describeConditionTree(conditions, { results })).toBeUndefined();
  });
});
