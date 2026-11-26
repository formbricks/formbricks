import { describe, expect, test } from "vitest";
import { splitPastedInput, splitTypedInput } from "./typed-input";

describe("splitTypedInput (ENG-7248)", () => {
  test("a typed comma or semicolon ends a value", () => {
    expect(splitTypedInput("Sweden,")).toEqual({ commit: ["Sweden"], rest: "" });
    expect(splitTypedInput("Sweden; Nor")).toEqual({ commit: ["Sweden"], rest: "Nor" });
  });

  test("leaves text without a separator in the input, and skips blank values", () => {
    expect(splitTypedInput("Washington")).toEqual({ commit: [], rest: "Washington" });
    expect(splitTypedInput(" ,; ")).toEqual({ commit: [], rest: "" });
  });
});

describe("splitPastedInput", () => {
  test("turns a paste with separators into one value each, after what was typed", () => {
    expect(splitPastedInput("Ice", "land; Denmark, Finland")).toEqual(["Iceland", "Denmark", "Finland"]);
  });

  test("replaces the selected text instead of appending to it", () => {
    expect(splitPastedInput("Sweden", "Denmark; Finland", 0, 6)).toEqual(["Denmark", "Finland"]);
    expect(splitPastedInput("Ice!", "land; Norway", 3, 4)).toEqual(["Iceland", "Norway"]);
  });

  test("inserts at a caret before the end", () => {
    expect(splitPastedInput("Swe", "Den, Fin", 0)).toEqual(["Den", "FinSwe"]);
  });

  test("leaves a paste without a separator as text", () => {
    expect(splitPastedInput("", "Denmark")).toBeNull();
  });
});
