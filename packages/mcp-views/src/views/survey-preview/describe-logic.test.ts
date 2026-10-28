import { describe, expect, test } from "vitest";
import { type LogicContext, describeBlockLogic, describeFallback } from "./describe-logic";

const context: LogicContext = {
  languageCode: "en-US",
  defaultLanguage: "en-US",
  elements: new Map([
    ["q_reason", { number: 2, choices: new Map([["c_price", "Price"]]) }],
    ["q_score", { number: 1, choices: new Map() }],
  ]),
  blocks: new Map([
    ["b_text", { number: 4, name: "Open feedback" }],
    ["b_multi", { number: 3, name: "" }],
  ]),
  endings: new Map([["end_1", 1]]),
  variables: new Map([["var_1", "score"]]),
};

const rule = (conditions: unknown[], actions: unknown[], connector = "and") => [
  { id: "r", conditions: { id: "g", connector, conditions }, actions },
];

describe("describeBlockLogic", () => {
  test("names the question, the operator, the choice label and the target block", () => {
    const sentences = describeBlockLogic(
      rule(
        [
          {
            id: "c",
            leftOperand: { type: "element", value: "q_reason" },
            operator: "equals",
            rightOperand: { type: "static", value: "c_price" },
          },
        ],
        [{ id: "a", objective: "jumpToBlock", target: "b_text" }]
      ),
      context
    );
    expect(sentences).toEqual(['If Question 2 equals "Price", jump to block 4 (Open feedback).']);
  });

  test("joins conditions with the connector and parenthesises nested groups", () => {
    const [sentence] = describeBlockLogic(
      rule(
        [
          { id: "c1", leftOperand: { type: "element", value: "q_score" }, operator: "isSubmitted" },
          {
            id: "g2",
            connector: "or",
            conditions: [
              {
                id: "c2",
                leftOperand: { type: "element", value: "q_score" },
                operator: "isGreaterThan",
                rightOperand: { type: "static", value: 8 },
              },
              { id: "c3", leftOperand: { type: "hiddenField", value: "plan" }, operator: "isSet" },
            ],
          },
        ],
        [{ id: "a", objective: "requireAnswer", target: "q_reason" }]
      ),
      context
    );
    expect(sentence).toBe(
      'If Question 1 is answered and (Question 1 is greater than "8" or hidden field plan is set), require Question 2.'
    );
  });

  test("describes variable calculations", () => {
    const [sentence] = describeBlockLogic(
      rule(
        [{ id: "c", leftOperand: { type: "element", value: "q_score" }, operator: "isSkipped" }],
        [
          {
            id: "a1",
            objective: "calculate",
            variableId: "var_1",
            operator: "add",
            value: { type: "static", value: 1 },
          },
          {
            id: "a2",
            objective: "calculate",
            variableId: "var_1",
            operator: "assign",
            value: { type: "static", value: 0 },
          },
        ]
      ),
      context
    );
    expect(sentence).toBe(
      'If Question 1 is skipped, add "1" to variable score and set variable score to "0".'
    );
  });

  test("says so when a rule points at something that was removed", () => {
    const [sentence] = describeBlockLogic(
      rule(
        [{ id: "c", leftOperand: { type: "element", value: "gone" }, operator: "isSet" }],
        [{ id: "a", objective: "jumpToBlock", target: "gone_block" }]
      ),
      context
    );
    expect(sentence).toBe("If a removed question is set, jump to a removed block.");
  });

  test("returns nothing for a block without logic", () => {
    expect(describeBlockLogic(undefined, context)).toEqual([]);
  });
});

describe("describeFallback", () => {
  test("names an ending or a block", () => {
    expect(describeFallback("b_multi", context)).toBe("Otherwise, jump to block 3.");
    expect(describeFallback("end_1", context)).toBe("Otherwise, jump to ending 1.");
    expect(describeFallback(undefined, context)).toBeUndefined();
  });
});
