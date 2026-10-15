import { describe, expect, test } from "vitest";
import type { TShowConditionGroup } from "@formbricks/types/show-conditions";
import { describeActual, describeCondition, describeOutcome, findCondition } from "@/debug-panel/format";
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
    [
      event({ outcome: "conditionsFailed", stage: "afterDelay" }),
      "Not shown: show conditions not met after the delay",
    ],
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
