import { describe, expect, test } from "vitest";
import {
  type TPreselectableElement,
  getPreselectAnswerValueIssue,
  resolvePreselectedAnswer,
} from "./preselect-answer";

const single: TPreselectableElement = {
  id: "status",
  type: "multipleChoiceSingle",
  choices: [
    { id: "open", label: { default: "Open/Pending", de: "Offen" } },
    { id: "closed", label: { default: "Closed", de: "Geschlossen" } },
    { id: "other", label: { default: "Other" } },
  ],
};
const multi: TPreselectableElement = { ...single, id: "topics", type: "multipleChoiceMulti" };
const text: TPreselectableElement = { id: "ein", type: "openText", inputType: "text" };
const number: TPreselectableElement = { id: "count", type: "openText", inputType: "number" };

describe("getPreselectAnswerValueIssue", () => {
  test('accepts "None of these" on its own', () => {
    const withNone: TPreselectableElement = {
      ...multi,
      choices: [...(multi.choices ?? []), { id: "none", label: { default: "None" } }],
    };
    expect(getPreselectAnswerValueIssue(withNone, { type: "choices", choiceIds: ["none"] })).toBeUndefined();
  });

  test("accepts one option of a single select, several of a multi select, and a free text value", () => {
    expect(getPreselectAnswerValueIssue(single, { type: "choices", choiceIds: ["open"] })).toBeUndefined();
    expect(
      getPreselectAnswerValueIssue(multi, { type: "choices", choiceIds: ["open", "closed"] })
    ).toBeUndefined();
    expect(getPreselectAnswerValueIssue(text, { type: "static", value: "0" })).toBeUndefined();
    expect(getPreselectAnswerValueIssue(number, { type: "static", value: "-1.5" })).toBeUndefined();
    expect(getPreselectAnswerValueIssue(number, { type: "static", value: "2e3" })).toBeUndefined();
  });

  test.each([
    [
      "a question type it can't fill",
      { id: "r", type: "rating" },
      { type: "choices", choiceIds: ["x"] },
      "rating",
    ],
    [
      "two options in a single select",
      single,
      { type: "choices", choiceIds: ["open", "closed"] },
      "exactly one",
    ],
    ["the same option twice", multi, { type: "choices", choiceIds: ["open", "open"] }, "twice"],
    ["the Other option", multi, { type: "choices", choiceIds: ["other"] }, "Other"],
    [
      '"None of these" with another option',
      { ...multi, choices: [...(multi.choices ?? []), { id: "none", label: { default: "None" } }] },
      { type: "choices", choiceIds: ["none", "open"] },
      "picked alone",
    ],
    [
      "an option the question doesn't have",
      single,
      { type: "choices", choiceIds: ["gone"] },
      "no option gone",
    ],
    ["options for a free text question", text, { type: "choices", choiceIds: ["open"] }, "free text"],
    ["a value for a select question", single, { type: "static", value: "Open/Pending" }, "not a value"],
    ["text for a number question", number, { type: "static", value: "zero" }, "not one"],
    // Number() takes these, but a number input clears them, so the respondent would see nothing.
    ["a hexadecimal number", number, { type: "static", value: "0x10" }, "not one"],
    ["a number with spaces around it", number, { type: "static", value: " 1 " }, "not one"],
  ] as const)("refuses %s", (_case, element, value, message) => {
    expect(getPreselectAnswerValueIssue(element, value)).toContain(message);
  });
});

describe("resolvePreselectedAnswer", () => {
  test("names options by their label in the respondent's language", () => {
    expect(resolvePreselectedAnswer(single, { type: "choices", choiceIds: ["open"] }, "default")).toBe(
      "Open/Pending"
    );
    expect(resolvePreselectedAnswer(single, { type: "choices", choiceIds: ["open"] }, "de")).toBe("Offen");
    expect(resolvePreselectedAnswer(multi, { type: "choices", choiceIds: ["closed", "open"] }, "de")).toEqual(
      ["Geschlossen", "Offen"]
    );
  });

  test("falls back to the default label when the language has none", () => {
    expect(resolvePreselectedAnswer(single, { type: "choices", choiceIds: ["open"] }, "fr")).toBe(
      "Open/Pending"
    );
  });

  test("gives a free text value as it is", () => {
    expect(resolvePreselectedAnswer(text, { type: "static", value: "0" }, "de")).toBe("0");
  });

  test("gives nothing for a pre-selection that no longer fits its question", () => {
    expect(resolvePreselectedAnswer(single, { type: "choices", choiceIds: ["deleted"] }, "default")).toBe(
      undefined
    );
    expect(resolvePreselectedAnswer(text, { type: "choices", choiceIds: ["open"] }, "default")).toBe(
      undefined
    );
  });
});
