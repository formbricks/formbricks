import { describe, expect, test } from "vitest";
import { toDisplayFileName } from "./display-file-name";

describe("toDisplayFileName", () => {
  test.each([
    ["a bidirectional override", "invoice\u202Egpj.exe", "invoicegpj.exe"],
    ["isolates and marks", "a\u2066b\u2069c\u200Ed\u200Fe\u061Cf", "abcdef"],
    ["C0 and C1 controls", "a\u0000b\u0007c\u009fd", "abcd"],
    ["a lone surrogate", "a\uD800b", "ab"],
    ["whitespace controls, as one space", "a\tb\n\nc\u2028d", "a b c d"],
    ["surrounding whitespace", "  survey.qsf  ", "survey.qsf"],
  ])("removes %s", (_case, name, expected) => {
    expect(toDisplayFileName(name)).toBe(expected);
  });

  test("keeps printable characters a file system might refuse, since the name is only shown", () => {
    expect(toDisplayFileName('Q3: "Pulse" <draft>/v2?.qsf')).toBe('Q3: "Pulse" <draft>/v2?.qsf');
  });

  test("composes a decomposed name to NFC", () => {
    expect(toDisplayFileName("Gro\u0308sse.qsf")).toBe("Grösse.qsf");
  });

  test("is empty when nothing readable is left", () => {
    expect(toDisplayFileName("\u202E\u200F\u0000 \t")).toBe("");
  });
});
