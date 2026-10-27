import { describe, expect, test } from "vitest";
import { carryOverCodes, fillMissingCodes } from "./fill-missing-codes";

type El = Record<string, unknown> & { id: string; type: string };
const block = (id: string, ...elements: El[]) => ({ id, name: id, elements });
const open = (id: string, extra: Record<string, unknown> = {}): El => ({ id, type: "openText", ...extra });
const choice = (id: string, code?: string) => ({ id, label: { default: id }, ...(code ? { code } : {}) });
const single = (
  id: string,
  choices: ReturnType<typeof choice>[],
  extra: Record<string, unknown> = {}
): El => ({
  id,
  type: "multipleChoiceSingle",
  choices,
  ...extra,
});

const codesOf = (blocks: ReturnType<typeof block>[]) => blocks.flatMap((b) => b.elements.map((e) => e.code));
const optionCodes = (element: El, key = "choices") =>
  (element[key] as { code?: string }[]).map((option) => option.code);

describe("fillMissingCodes: question codes", () => {
  test("codes an uncoded survey q1..qn in document order across blocks", () => {
    const result = fillMissingCodes([block("b1", open("a"), open("b")), block("b2", open("c"))], []);
    expect(codesOf(result)).toEqual(["q1", "q2", "q3"]);
  });

  test("keeps an existing code and never renumbers around it", () => {
    const result = fillMissingCodes(
      [block("b1", open("a", { code: "age" }), open("b", { code: "q7" }), open("c"))],
      []
    );
    expect(codesOf(result)).toEqual(["age", "q7", "q8"]);
  });

  test("a gap is not filled: the highest q number plus one wins", () => {
    const result = fillMissingCodes(
      [block("b1", open("a", { code: "q1" }), open("b"), open("c", { code: "q4" }))],
      []
    );
    expect(codesOf(result)).toEqual(["q1", "q5", "q4"]);
  });

  test("a deleted tail frees its number: q1, q2 left, the new question is q3", () => {
    const result = fillMissingCodes(
      [block("b1", open("a", { code: "q1" }), open("b", { code: "q2" }), open("new"))],
      []
    );
    expect(codesOf(result)).toEqual(["q1", "q2", "q3"]);
  });

  test("is not fooled by upper case or a longer code that starts with q and a number", () => {
    const result = fillMissingCodes(
      [block("b1", open("a", { code: "q12" }), open("b", { code: "q9x" }), open("c"))],
      []
    );
    expect(codesOf(result)).toEqual(["q12", "q9x", "q13"]);
  });

  test("skips an Embedded Data name, ignoring case", () => {
    const result = fillMissingCodes([block("b1", open("a"), open("b"))], ["Q1", "q3"]);
    expect(codesOf(result)).toEqual(["q2", "q4"]);
  });

  test("skips another question's Question ID, ignoring case, but not its own", () => {
    const result = fillMissingCodes([block("b1", open("zzz"), open("Q1"))], []);
    expect(codesOf(result)).toEqual(["q2", "q3"]);
    const own = fillMissingCodes([block("b1", open("q1"), open("q2"))], []);
    expect(codesOf(own)).toEqual(["q1", "q2"]);
  });

  test("gives a CTA no code", () => {
    const result = fillMissingCodes([block("b1", { id: "intro", type: "cta" }, open("a"))], []);
    expect(result[0].elements[0]).not.toHaveProperty("code");
    expect(result[0].elements[1].code).toBe("q1");
  });

  test("does not mutate its input and returns the same blocks when nothing is missing", () => {
    const input = [block("b1", open("a"))];
    const snapshot = structuredClone(input);
    const filled = fillMissingCodes(input, []);
    expect(input).toEqual(snapshot);
    expect(fillMissingCodes(filled, [])).toBe(filled);
  });

  test("a duplicate (no code on the element, answer codes kept) gets the next unused q<n>", () => {
    const original = single("a", [choice("x", "1"), choice("y", "2")], { code: "q1" });
    const copy: El = { ...structuredClone(original), id: "a2" };
    delete copy.code;
    const result = fillMissingCodes([block("b1", original, copy)], []);
    expect(result[0].elements[1].code).toBe("q2");
    expect(optionCodes(result[0].elements[1])).toEqual(["1", "2"]);
  });
});

describe("fillMissingCodes: answer codes", () => {
  test("codes options 1..n in order", () => {
    const result = fillMissingCodes([block("b1", single("a", [choice("x"), choice("y"), choice("z")]))], []);
    expect(optionCodes(result[0].elements[0])).toEqual(["1", "2", "3"]);
  });

  test("other and none take the next free code", () => {
    const result = fillMissingCodes(
      [block("b1", single("a", [choice("x"), choice("y"), choice("other"), choice("none")]))],
      []
    );
    expect(optionCodes(result[0].elements[0])).toEqual(["1", "2", "3", "4"]);
  });

  test("a new option after existing codes takes the next number, never a renumber", () => {
    const result = fillMissingCodes(
      [block("b1", single("a", [choice("x", "1"), choice("y", "3"), choice("n")]))],
      []
    );
    expect(optionCodes(result[0].elements[0])).toEqual(["1", "3", "4"]);
  });

  test("skips a number a custom code already took in the same question", () => {
    const result = fillMissingCodes([block("b1", single("a", [choice("x", "2"), choice("y")]))], []);
    expect(optionCodes(result[0].elements[0])).toEqual(["2", "3"]);
  });

  test("codes ranking and picture selection choices", () => {
    const result = fillMissingCodes(
      [
        block(
          "b1",
          { id: "r", type: "ranking", choices: [choice("x"), choice("y")] },
          {
            id: "p",
            type: "pictureSelection",
            choices: [
              { id: "i1", imageUrl: "u" },
              { id: "i2", imageUrl: "v" },
            ],
          }
        ),
      ],
      []
    );
    expect(optionCodes(result[0].elements[0])).toEqual(["1", "2"]);
    expect(optionCodes(result[0].elements[1])).toEqual(["1", "2"]);
  });

  test("codes matrix rows and columns separately", () => {
    const result = fillMissingCodes(
      [
        block("b1", {
          id: "m",
          type: "matrix",
          rows: [choice("r1"), choice("r2")],
          columns: [choice("c1"), choice("c2"), choice("c3")],
        }),
      ],
      []
    );
    expect(optionCodes(result[0].elements[0], "rows")).toEqual(["1", "2"]);
    expect(optionCodes(result[0].elements[0], "columns")).toEqual(["1", "2", "3"]);
  });

  test.each(["nps", "rating", "csat", "ces"])("%s gets a question code and no answer codes", (type) => {
    const result = fillMissingCodes([block("b1", { id: "s", type })], []);
    expect(result[0].elements[0]).toEqual({ id: "s", type, code: "q1" });
  });
});

describe("carryOverCodes", () => {
  test("copies stored codes onto a replaced element and its options by id", () => {
    const stored = [block("b1", single("a", [choice("x", "1"), choice("y", "2")], { code: "age" }))];
    const next = [block("b1", single("a", [choice("x"), choice("y"), choice("z")]))];
    const carried = carryOverCodes(stored, next);
    expect(carried[0].elements[0].code).toBe("age");
    expect(optionCodes(carried[0].elements[0])).toEqual(["1", "2", undefined]);
  });

  test("follows an element that moved to another block and keeps a code the caller sent", () => {
    const stored = [block("b1", open("a", { code: "q1" }), open("b", { code: "q2" }))];
    const next = [block("b2", open("b")), block("b1", open("a", { code: "mine" }))];
    const carried = carryOverCodes(stored, next);
    expect(carried[0].elements[0].code).toBe("q2");
    expect(carried[1].elements[0].code).toBe("mine");
  });

  test("leaves new elements alone", () => {
    const carried = carryOverCodes([block("b1", open("a", { code: "q1" }))], [block("b1", open("new"))]);
    expect(carried[0].elements[0]).not.toHaveProperty("code");
  });
});
