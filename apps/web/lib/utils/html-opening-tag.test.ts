import { describe, expect, test } from "vitest";
import { findOpeningTag, replaceOpeningTags } from "./html-opening-tag";

// The regexes this module replaces, kept here as the oracle every case is compared against.
const asRegex = (name: string, wordBoundary = true) =>
  new RegExp(`<${name}${wordBoundary ? String.raw`\b` : ""}([^>]*)>`, "gi");

const CASES: { name: string; wordBoundary?: boolean }[] = [
  { name: "p" },
  { name: "li" },
  { name: "body" },
  { name: "!DOCTYPE", wordBoundary: false },
];

const FIXED = [
  "",
  "<p>a</p>",
  '<p style="margin:0" class="x">a</p>',
  "<p >spaced</p><P>upper</P>",
  "<pre>not a p</pre>",
  "<p",
  "<p unclosed",
  "<li><p>nested</p></li>",
  "<!DOCTYPE html><body>x</body>",
  "<!DOCTYPEhtml>",
  "<body\ndata-x='1'\n>multiline",
  "<p a><p b><p c>",
  "text with no tags at all",
  "<p></p><p></p>",
  "<p_underscore>",
  // The shapes a length cap got wrong: an over-long run containing another opening tag.
  `<p ${"a".repeat(5000)}<p style="x">tail`,
  `<li ${"a".repeat(5000)}<li style="x">tail`,
  `<body ${"a".repeat(5000)}<body class="x">inner`,
  `<!DOCTYPE ${"a".repeat(5000)}<!DOCTYPE html>rest`,
  // U+0130 lowercases to two code units; a toLowerCase()-based scan would misalign here.
  "İ<p style='x'>after a length-changing character</p>",
];

const ALPHABET = "<>/plibodyPLIBODY!DCTYPE \n\t\"'=-0_";
const random = Array.from({ length: 20000 }, () => {
  const n = Math.floor(Math.random() * 40);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
});
const CORPUS = [...FIXED, ...random];

describe("html opening tag scanner", () => {
  test.each(CASES)("replaceOpeningTags matches the regex it replaces ($name)", ({ name, wordBoundary }) => {
    for (const source of CORPUS) {
      const viaRegex = source.replace(asRegex(name, wordBoundary), (_m, attrs: string) => `[${attrs}]`);
      const viaScan = replaceOpeningTags(source, name, (attrs) => `[${attrs}]`, {
        requireWordBoundary: wordBoundary,
      });

      expect(viaScan, `input: ${JSON.stringify(source.slice(0, 60))}`).toBe(viaRegex);
    }
  });

  test.each(CASES)(
    "findOpeningTag reports the regex's index and capture ($name)",
    ({ name, wordBoundary }) => {
      for (const source of CORPUS) {
        const expected = asRegex(name, wordBoundary).exec(source);
        const actual = findOpeningTag(source, name, { requireWordBoundary: wordBoundary });

        if (expected === null) {
          expect(actual, `input: ${JSON.stringify(source.slice(0, 60))}`).toBeNull();
          continue;
        }
        expect(actual, `input: ${JSON.stringify(source.slice(0, 60))}`).toEqual({
          index: expected.index,
          length: expected[0].length,
          attributes: expected[1],
        });
      }
    }
  );

  test("stays linear where the regex was quadratic", () => {
    // `<p ` repeated with no `>` anywhere: the regex rescans to the end from every occurrence.
    const pathological = "<p ".repeat(70000);

    const startedAt = performance.now();
    const result = replaceOpeningTags(pathological, "p", (attrs) => `[${attrs}]`);
    const elapsedMs = performance.now() - startedAt;

    expect(result).toBe(pathological);
    expect(elapsedMs).toBeLessThan(500);
  });
});
