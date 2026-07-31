import { describe, expect, test } from "vitest";
import { getBlankSendEmailContentFields, isBlankWorkflowRichText } from "./content";

describe("isBlankWorkflowRichText", () => {
  test("treats an empty string as blank", () => {
    expect(isBlankWorkflowRichText("")).toBe(true);
    expect(isBlankWorkflowRichText("   \n ")).toBe(true);
  });

  test("treats the markup a fully deleted Lexical body serializes to as blank", () => {
    // What the editor's serializer emits once the user removes every character: the enclosing
    // block survives. A plain `.trim()` reads this as 40+ characters of content.
    expect(isBlankWorkflowRichText("<p><br></p>")).toBe(true);
    expect(isBlankWorkflowRichText('<p class="fb-editor-paragraph" dir="ltr"><br></p>')).toBe(true);
    expect(isBlankWorkflowRichText("<p></p><p></p>")).toBe(true);
  });

  test("treats whitespace entities as blank", () => {
    expect(isBlankWorkflowRichText("<p>&nbsp;</p>")).toBe(true);
    expect(isBlankWorkflowRichText("<p>&#160;&#xA0;</p>")).toBe(true);
  });

  test("treats real text as filled", () => {
    expect(isBlankWorkflowRichText("<p>Thanks!</p>")).toBe(false);
    expect(isBlankWorkflowRichText("Hi there")).toBe(false);
    expect(isBlankWorkflowRichText('<p><span style="font-weight: bold">x</span></p>')).toBe(false);
  });

  test("treats visible text containing an angle bracket as filled", () => {
    // The serializer un-escapes `&lt;`/`&gt;` before storing, so these brackets are real content.
    // Stripping anything bracket-shaped would read them as empty and block enabling.
    expect(isBlankWorkflowRichText("<p><3</p>")).toBe(false);
    expect(isBlankWorkflowRichText("<p>5 < 6</p>")).toBe(false);
    expect(isBlankWorkflowRichText("<p>a > b</p>")).toBe(false);
  });

  test("treats a recall-token-only body as filled", () => {
    // RecallNode.exportDOM writes the token as the element's text content, so a body that is
    // nothing but a recall reference must not be mistaken for an empty one.
    expect(
      isBlankWorkflowRichText(
        '<p><span data-recall-id="abc" data-fallback-value="there">#recall:abc/fallback:there#</span></p>'
      )
    ).toBe(false);
  });
});

describe("getBlankSendEmailContentFields", () => {
  const filled = { to: "user@example.com", subject: "Hello", body: "<p>Hi</p>" };

  test("reports nothing for a fully configured action", () => {
    expect(getBlankSendEmailContentFields(filled)).toEqual([]);
  });

  test("reports blank fields in form order", () => {
    expect(getBlankSendEmailContentFields({ to: "", subject: " ", body: "" })).toEqual([
      "to",
      "subject",
      "body",
    ]);
  });

  test("reports a body that only looks filled", () => {
    expect(getBlankSendEmailContentFields({ ...filled, body: "<p><br></p>" })).toEqual(["body"]);
  });

  test("applies plain-text trimming to to and subject", () => {
    expect(getBlankSendEmailContentFields({ ...filled, subject: "   " })).toEqual(["subject"]);
    // `to` holds an element id or email, never markup — angle brackets there are real content.
    expect(getBlankSendEmailContentFields({ ...filled, to: "<p><br></p>" })).toEqual([]);
  });
});
