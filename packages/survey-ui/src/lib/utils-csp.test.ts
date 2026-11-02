import { describe, expect, test } from "vitest";
import { removeStyleAttributes } from "./utils";

// Under a strict `style-src` the browser reports every element it parses with a style attribute, so the
// attribute has to leave the raw string before anything parses it. Whether the markup then stays clean in
// the shipped bundle is checked in a real browser by apps/web/playwright/survey-csp.spec.ts; this table
// owns the spellings of the attribute the regex has to recognise.
describe("removeStyleAttributes", () => {
  test.each([
    ["double-quoted", '<p style="color: red;">Hi</p>', "<p>Hi</p>"],
    ["single-quoted", "<p style='color: red;'>Hi</p>", "<p>Hi</p>"],
    ["empty", '<p style="">Hi</p>', "<p>Hi</p>"],
    ["upper case", '<p STYLE="color: red;">Hi</p>', "<p>Hi</p>"],
    ["after another attribute", '<p class="a" style="color: red;">Hi</p>', '<p class="a">Hi</p>'],
    ["after a newline", '<p class="a"\nstyle="color: red;">Hi</p>', '<p class="a">Hi</p>'],
    ["after a tab", '<p\tstyle="color: red;">Hi</p>', "<p>Hi</p>"],
    ["with spaces around =", '<p style = "color: red;">Hi</p>', "<p>Hi</p>"],
    [
      "nested, as the editor saves it",
      '<p dir="ltr"><span style="white-space: pre-wrap;">Hi</span></p>',
      '<p dir="ltr"><span>Hi</span></p>',
    ],
    ["a value that contains >", '<p style="background: url(a>b)">Hi</p>', "<p>Hi</p>"],
    [
      "next to an attribute whose value mentions style",
      `<a title="Choose style = 'casual'" style="color: red">Hi</a>`,
      `<a title="Choose style = 'casual'">Hi</a>`,
    ],
    ["in a self-closing tag", '<br style="clear: both" />', "<br />"],
    ["in every tag of a string", '<p style="a">x</p><p style="b">y</p>', "<p>x</p><p>y</p>"],
  ])("removes a style attribute: %s", (_, html, expected) => {
    expect(removeStyleAttributes(html)).toBe(expected);
  });

  test.each([
    ["a data- attribute", '<p data-style="x">Hi</p>'],
    ["a class named style", '<p class="style">Hi</p>'],
    ["markup without styles", '<p class="a">Hi</p>'],
    ["plain text", "Tom & Jerry"],
    ["the word style in text", "<p>the style guide</p>"],
    ["text that looks like an attribute", `<p>Choose style = 'casual' or style="bold"</p>`],
    ["an attribute value that looks like one", `<a title="Choose style = 'casual'">Hi</a>`],
    ["a stray <", "1 < 2 and style='x' > 0"],
  ])("leaves %s alone", (_, html) => {
    expect(removeStyleAttributes(html)).toBe(html);
  });
});
