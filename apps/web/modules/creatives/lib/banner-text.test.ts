// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { bannerHtmlToRuns, bannerRunsToHtml, getBannerPlainText } from "./banner-text";

// What the shared rich-text editor (Lexical) hands back for "Down tonight. **Back at 4** [Details](…)"
// with the link underlined: its own theme classes, the format tags it wraps text in, and pre-wrap styles.
const EDITOR_HTML =
  '<p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Down tonight. </span>' +
  '<b><strong class="fb-editor-text-bold" style="white-space: pre-wrap;">Back at 4</strong></b>' +
  '<a href="https://example.com/status" class="fb-editor-link" target="_blank" rel="noopener noreferrer">' +
  '<u><span class="fb-editor-text-underline" style="white-space: pre-wrap;">Details</span></u></a></p>';

describe("bannerHtmlToRuns", () => {
  test("turns the editor's markup into text runs with their formatting and link", () => {
    expect(bannerHtmlToRuns(EDITOR_HTML)).toEqual([
      { text: "Down tonight. " },
      { text: "Back at 4", bold: true },
      { text: "Details", underline: true, href: "https://example.com/status" },
    ]);
  });

  test("an empty editor is an empty message", () => {
    expect(bannerHtmlToRuns('<p class="fb-editor-paragraph"><br></p>')).toEqual([]);
    expect(bannerHtmlToRuns("")).toEqual([]);
  });

  test("paragraphs and line breaks become line breaks, and runs with the same formatting merge", () => {
    expect(bannerHtmlToRuns("<p>One</p><p>Two<br>Three</p>")).toEqual([{ text: "One\nTwo\nThree" }]);
    expect(bannerHtmlToRuns("<p><em>Soon</em><i>!</i></p>")).toEqual([{ text: "Soon!", italic: true }]);
  });

  test("drops the line breaks the message starts or ends with, however many, and keeps the inner ones", () => {
    expect(bannerHtmlToRuns("<p><br></p><p>Hello</p><p><br></p><p><br></p>")).toEqual([{ text: "Hello" }]);
    expect(bannerHtmlToRuns("<p><strong>Hi</strong></p><p><br></p>")).toEqual([{ text: "Hi", bold: true }]);
    expect(bannerHtmlToRuns("<p>One</p><p><br></p><p>Two</p><p><br></p>")).toEqual([{ text: "One\n\nTwo" }]);
    expect(bannerHtmlToRuns(`<p>Long</p>${"<br>".repeat(5_000)}`)).toEqual([{ text: "Long" }]);
  });

  test("keeps only links the banner may carry, and the text of any other", () => {
    expect(
      bannerHtmlToRuns(
        '<p><a href="javascript:alert(1)">Bad</a> <a href="/open-enrollment">Enroll</a> ' +
          '<a href="mailto:help@example.com">Mail</a></p>'
      )
    ).toEqual([
      { text: "Bad " },
      { text: "Enroll", href: "/open-enrollment" },
      { text: " " },
      { text: "Mail", href: "mailto:help@example.com" },
    ]);
  });
});

describe("bannerRunsToHtml", () => {
  test("round-trips formatted runs through the editor's markup", () => {
    const runs = [
      { text: "Maintenance <tonight> & " },
      { text: "02:00", bold: true, italic: true },
      { text: "\n" },
      { text: "Status", href: "https://example.com/status?a=1&b=2", underline: true },
    ];

    expect(bannerHtmlToRuns(bannerRunsToHtml(runs))).toEqual([
      { text: "Maintenance <tonight> & " },
      { text: "02:00", bold: true, italic: true },
      { text: "\n" },
      { text: "Status", underline: true, href: "https://example.com/status?a=1&b=2" },
    ]);
  });

  test("starts a paragraph at every line break, empty ones included", () => {
    expect(bannerRunsToHtml([{ text: "A\n" }, { text: "\nB", bold: true }])).toBe(
      "<p>A</p><p></p><p><strong>B</strong></p>"
    );
  });
});

describe("getBannerPlainText", () => {
  test("is the message without its formatting", () => {
    expect(getBannerPlainText([{ text: "Down tonight. " }, { text: "Details", href: "/x" }])).toBe(
      "Down tonight. Details"
    );
  });
});
