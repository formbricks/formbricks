import { describe, expect, test } from "vitest";
import { decodeHtmlEntities, splitHeadline, stripHtml } from "./strip-html";

describe("stripHtml", () => {
  test.each([
    ["<p>Plain <strong>bold</strong> text</p>", "Plain bold text"],
    ["Line one<br>Line two<br/>Line three", "Line one Line two Line three"],
    ['<span style="color:red">Red</span>&nbsp;text&amp;more &lt;tag&gt;', "Red text&more <tag>"],
    ["<ul><li>One</li><li>Two</li></ul>", "One Two"],
    ["  Lots   of\n\twhitespace  ", "Lots of whitespace"],
    ["<script>alert(1)</script>Safe<style>.x{}</style>", "Safe"],
    ["Caf&eacute; &#233; &#xE9; &rsquo;", "Caf&eacute; é é ’"],
  ])("%j → %j", (input, expected) => {
    expect(stripHtml(input)).toBe(expected);
  });

  test("decodeHtmlEntities leaves unknown entities alone", () => {
    expect(decodeHtmlEntities("&unknown; &amp;")).toBe("&unknown; &");
  });
});

describe("splitHeadline", () => {
  test("keeps short text whole", () => {
    expect(splitHeadline("How are you?", 500)).toEqual({ headline: "How are you?", rest: null });
  });

  test("splits long text at the first sentence end that fits", () => {
    const long = `${"Intro sentence that is long enough to count. ".trim()} ${"x".repeat(600)}`;
    const result = splitHeadline(long, 500);
    expect(result.headline).toBe("Intro sentence that is long enough to count.");
    expect(result.rest?.startsWith("xxx")).toBe(true);
  });

  test("falls back to a word boundary when there is no sentence end", () => {
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const result = splitHeadline(words, 500);
    expect(result.headline.length).toBeLessThanOrEqual(500);
    expect(result.headline.endsWith(" ")).toBe(false);
    expect(result.rest).not.toBeNull();
  });
});
