import { sanitize } from "isomorphic-dompurify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { sanitizeSurveyHtml, stripInlineStyles } from "./utils";

// Under a `style-src` without 'unsafe-inline', the browser reports a violation for every element it
// *parses* with a `style` attribute, even when the sanitizer throws the attribute away afterwards. So the
// property to prove is on the sanitizer's INPUT: no markup with a style attribute may reach it. The real
// sanitizer runs (a mock would hide the output), wrapped only so its calls can be read.
vi.mock("isomorphic-dompurify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("isomorphic-dompurify")>();
  return { ...actual, sanitize: vi.fn(actual.sanitize) };
});

const STYLE_ATTRIBUTE = /\sstyle\s*=/i;

const STYLED_HTML = [
  ["double-quoted", '<p style="color: red;">Hi</p>'],
  ["empty", '<p style="">Hi</p>'],
  ["single-quoted", "<p style='color: red;'>Hi</p>"],
  ["uppercase", '<p STYLE="color: red;">Hi</p>'],
  ["editor output", '<p dir="ltr"><span style="white-space: pre-wrap;">Hi</span></p>'],
  ["after a newline", '<p class="a"\nstyle="color: red;">Hi</p>'],
  ["after a tab", '<p\tstyle="color: red;">Hi</p>'],
  ["with spaces around =", '<p style = "color: red;">Hi</p>'],
] as const;

const sanitizerInputsWithStyle = (): string[] =>
  vi
    .mocked(sanitize)
    .mock.calls.map(([html]) => String(html))
    .filter((html) => STYLE_ATTRIBUTE.test(html));

describe("inline styles never reach the sanitizer's parser", () => {
  afterEach(() => {
    vi.mocked(sanitize).mockClear();
  });

  test.each(STYLED_HTML)("stripInlineStyles, %s", (_, html) => {
    expect(stripInlineStyles(html)).toContain("Hi");
    expect(sanitizerInputsWithStyle()).toEqual([]);
  });

  test.each(STYLED_HTML)("sanitizeSurveyHtml, %s", (_, html) => {
    expect(sanitizeSurveyHtml(html)).toContain("Hi");
    expect(sanitizerInputsWithStyle()).toEqual([]);
  });

  test("text that merely mentions a style attribute is not rewritten", () => {
    expect(stripInlineStyles("<p>data-style is not a style attribute</p>")).toBe(
      "<p>data-style is not a style attribute</p>"
    );
    expect(stripInlineStyles('<p data-style="x">Hi</p>')).toBe('<p data-style="x">Hi</p>');
  });
});
