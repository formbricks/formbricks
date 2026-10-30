import { describe, expect, test } from "vitest";
import { closestOption, resolveAnswerOption } from "./option-matcher";

const choice = (id: string, code: string, label: Record<string, string>) => ({ id, code, label });

const colors = [
  choice("c1", "1", { default: "Red", ar: "أحمر" }),
  choice("c2", "2", { default: "Blue", ar: "أزرق" }),
  choice("c3", "3", { default: "Green", ar: "أخضر" }),
];

describe("resolveAnswerOption", () => {
  test("matches the response language first", () => {
    expect(resolveAnswerOption({ text: "أزرق", choices: colors, language: "ar" })).toEqual({
      status: "matched",
      choice: colors[1],
    });
  });

  test("an Arabic and an English answer resolve to the same code", () => {
    const ar = resolveAnswerOption({ text: "أحمر", choices: colors, language: "ar" });
    const en = resolveAnswerOption({ text: "Red", choices: colors, language: "default" });
    expect(ar).toMatchObject({ status: "matched", choice: { code: "1" } });
    expect(en).toMatchObject({ status: "matched", choice: { code: "1" } });
  });

  test("falls back to any language when the response language does not carry the text", () => {
    expect(resolveAnswerOption({ text: "Green", choices: colors, language: "ar" })).toMatchObject({
      status: "matched",
      choice: { code: "3" },
    });
  });

  test("an option renamed after the answer was given is unmapped, not guessed", () => {
    const renamed = [choice("c1", "1", { default: "Crimson", ar: "قرمزي" }), colors[1]];
    expect(resolveAnswerOption({ text: "Red", choices: renamed, language: "default" })).toEqual({
      status: "unmapped",
      reason: "no_match",
    });
  });

  test("a non-match is Other only when the question has an Other option", () => {
    const withOther = [...colors, choice("other", "98", { default: "Other" })];
    expect(resolveAnswerOption({ text: "Purple", choices: withOther, language: "default" })).toEqual({
      status: "other",
      choice: withOther[3],
    });
    expect(resolveAnswerOption({ text: "Purple", choices: colors, language: "default" })).toEqual({
      status: "unmapped",
      reason: "no_match",
    });
  });

  test("a text matching two options is unmapped, never an arbitrary pick", () => {
    const twins = [choice("a", "1", { default: "Yes" }), choice("b", "2", { default: "Yes" })];
    expect(resolveAnswerOption({ text: "Yes", choices: twins, language: "default" })).toEqual({
      status: "unmapped",
      reason: "ambiguous",
    });
  });

  test("a text matching two options in other languages only is ambiguous too", () => {
    const twins = [
      choice("a", "1", { default: "A", de: "Ja" }),
      choice("b", "2", { default: "B", fr: "Ja" }),
    ];
    expect(resolveAnswerOption({ text: "Ja", choices: twins, language: "es" })).toEqual({
      status: "unmapped",
      reason: "ambiguous",
    });
  });

  test("an ambiguity in the response language is not rescued by the any-language pass", () => {
    const twins = [
      choice("a", "1", { default: "A", de: "Ja" }),
      choice("b", "2", { default: "B", de: "Ja" }),
      choice("c", "3", { default: "Ja" }),
    ];
    expect(resolveAnswerOption({ text: "Ja", choices: twins, language: "de" })).toEqual({
      status: "unmapped",
      reason: "ambiguous",
    });
  });

  test("the Other option's own label reads as an Other write-in, never as a matched option", () => {
    const withOther = [...colors, choice("other", "98", { default: "Other" })];
    expect(resolveAnswerOption({ text: "Other", choices: withOther, language: "default" })).toMatchObject({
      status: "other",
    });
  });

  test("ignores surrounding whitespace and Unicode composition, nothing fuzzier", () => {
    const cafe = [choice("a", "1", { default: "Café" }), choice("b", "2", { default: "Tea" })];
    expect(resolveAnswerOption({ text: "  Café ", choices: cafe, language: "default" })).toMatchObject({
      status: "matched",
      choice: { code: "1" },
    });
    expect(resolveAnswerOption({ text: "red", choices: colors, language: "default" })).toMatchObject({
      status: "unmapped",
    });
  });

  test("an option without a code is still matched", () => {
    const uncoded = [
      { id: "x", label: { default: "Yes" } },
      { id: "y", label: { default: "No" } },
    ];
    expect(resolveAnswerOption({ text: "No", choices: uncoded, language: "default" })).toMatchObject({
      status: "matched",
      choice: { id: "y" },
    });
  });
});

describe("closestOption", () => {
  test("reports the most similar option and a 0 to 1 similarity", () => {
    const result = closestOption("Reed", colors);
    expect(result?.choice.code).toBe("1");
    expect(result?.similarity).toBeCloseTo(0.75, 2);
  });

  test("compares across every language and ignores case", () => {
    expect(closestOption("أزرق ", colors)?.choice.code).toBe("2");
    expect(closestOption("GREEN", colors)).toMatchObject({ choice: { code: "3" }, similarity: 1 });
  });

  test("returns null when there is nothing to compare with", () => {
    expect(closestOption("x", [])).toBeNull();
  });

  test("bounds the work on very long text", () => {
    const long = "a".repeat(100_000);
    expect(closestOption(long, colors)?.similarity).toBeLessThan(0.1);
  });
});
