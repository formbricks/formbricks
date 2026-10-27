import { describe, expect, test } from "vitest";
import { toEditorOutputHtml } from "./exported-html";

// Lexical's export of a paragraph someone typed `Contact <support@example.com>` into.
const EXPORTED =
  '<p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">' +
  "Contact &lt;support@example.com&gt;</span></p>";

describe("toEditorOutputHtml", () => {
  test("decodes the text's < and > by default, as every existing consumer stores it", () => {
    expect(toEditorOutputHtml(EXPORTED)).toBe(
      '<p class="fb-editor-paragraph" dir="ltr"><span style="">Contact <support@example.com></span></p>'
    );
  });

  test("keeps them escaped for a consumer that parses the markup as HTML again", () => {
    expect(toEditorOutputHtml(EXPORTED, { keepEscapedText: true })).toBe(
      '<p class="fb-editor-paragraph" dir="ltr"><span style="">Contact &lt;support@example.com&gt;</span></p>'
    );
  });
});
