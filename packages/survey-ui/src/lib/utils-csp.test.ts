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
    ["unquoted", "<p style=color:red>Hi</p>", "<p>Hi</p>"],
    ["unquoted, among other attributes", "<p class=a style=color:red id=b>Hi</p>", "<p class=a id=b>Hi</p>"],
    ["unquoted, with an empty value", "<p style=>Hi</p>", "<p>Hi</p>"],
    ["with no value at all", "<p style>Hi</p>", "<p>Hi</p>"],
    ["next to a data- attribute", '<p data-style="x" style="y">Hi</p>', '<p data-style="x">Hi</p>'],
    ["right after a closing quote", '<p title="x"style="color:red">Hi</p>', '<p title="x">Hi</p>'],
    ["right after a closing quote, unquoted", "<p class='a'style=color:red>Hi</p>", "<p class='a'>Hi</p>"],
    ["right after a slash", '<br/style="clear: both">', "<br/>"],
    ["after several spaces", '<p    style="x">Hi</p>', "<p   >Hi</p>"],
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
    ["an unquoted value that contains style=", "<p title=style=x>Hi</p>"],
    ["text after an unquoted attribute", "<a href=x>style=y</a>"],
    ["a style element", '<style media="print">p { color: red }</style>'],
    ["a stray <", "1 < 2 and style='x' > 0"],
  ])("leaves %s alone", (_, html) => {
    expect(removeStyleAttributes(html)).toBe(html);
  });

  // A run of whitespace inside a tag, followed by something that is not an attribute name, used to be
  // rescanned from every position: n spaces cost n squared steps (1.9 s at 40,000 on a fast machine).
  test.each([
    ["spaces then >", `<p${" ".repeat(60_000)}>`],
    ["spaces then /", `<p${" ".repeat(60_000)}/>`],
    ["tabs then =", `<p${"\t".repeat(60_000)}=>`],
  ])("stays fast on a long run of whitespace: %s", (_, html) => {
    const start = performance.now();
    removeStyleAttributes(html);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
