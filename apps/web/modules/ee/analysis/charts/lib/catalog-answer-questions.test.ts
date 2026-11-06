import { describe, expect, test } from "vitest";
import { toBuilderAnswerQuestions } from "./catalog-answer-questions";

describe("toBuilderAnswerQuestions", () => {
  test("no questions in the catalog, none in the builder", () => {
    expect(toBuilderAnswerQuestions([])).toEqual([]);
    expect(toBuilderAnswerQuestions(undefined)).toEqual([]);
  });

  test("turns the catalog's rule values back into the value keys the builder offers", () => {
    expect(
      toBuilderAnswerQuestions([
        {
          id: "q_delivery",
          label: "Delivery",
          kind: "choice",
          operators: ["equals", "notEquals"],
          options: [
            { value: "q_delivery:opt_late", label: "Late" },
            { value: "q_delivery:opt:with:colons", label: "Odd id" },
          ],
        },
        {
          id: "q_nps",
          label: "NPS",
          kind: "number",
          operators: ["equals", "notEquals"],
          options: [{ value: "q_nps:10", label: "10" }],
        },
      ])
    ).toEqual([
      {
        id: "q_delivery",
        label: "Delivery",
        kind: "choice",
        options: [
          { value: "opt_late", label: "Late" },
          { value: "opt:with:colons", label: "Odd id" },
        ],
      },
      { id: "q_nps", label: "NPS", kind: "number", options: [{ value: "10", label: "10" }] },
    ]);
  });

  test("drops an option whose value names another question", () => {
    expect(
      toBuilderAnswerQuestions([
        {
          id: "q_a",
          label: "A",
          kind: "multi",
          operators: ["equals"],
          options: [{ value: "q_b:x", label: "X" }],
        },
      ])
    ).toEqual([{ id: "q_a", label: "A", kind: "multi", options: [] }]);
  });
});
