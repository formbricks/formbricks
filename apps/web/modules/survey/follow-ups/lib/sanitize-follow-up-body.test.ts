import { describe, expect, test } from "vitest";
import { sanitizeFollowUpBody } from "./sanitize-follow-up-body";

/** What the Body editor's list buttons serialize (Lexical numbers `<li>` explicitly). */
const EDITOR_ORDERED_LIST =
  '<ol class="fb-editor-list-ol"><li value="1"><span>First step</span></li><li value="2"><span>Second step</span></li></ol>';

describe("sanitizeFollowUpBody", () => {
  test("keeps an ordered list authored with the editor's list button", () => {
    const sanitized = sanitizeFollowUpBody(EDITOR_ORDERED_LIST);

    // Regression: `ul`/`ol`/`li` used to be absent from the allowlist, and DOMPurify keeps the contents
    // of a tag it removes — so the list arrived as bare spans and the email ran the items together on
    // one unnumbered line.
    expect(sanitized).toMatch(/<ol\b/);
    expect(sanitized).toMatch(/<li\b[^>]*>.*First step.*<\/li>/);
    expect(sanitized).toMatch(/<li\b[^>]*>.*Second step.*<\/li>/);
    // The editor's list classes carry the email's list styling, so `class` has to survive too.
    expect(sanitized).toContain('class="fb-editor-list-ol"');
  });

  test("keeps the numbering of a list that does not start at 1", () => {
    const sanitized = sanitizeFollowUpBody('<ol start="3"><li value="3">Third</li></ol>');

    expect(sanitized).toContain('start="3"');
    expect(sanitized).toContain('value="3"');
  });

  test("keeps an unordered list", () => {
    expect(sanitizeFollowUpBody("<ul><li>Only item</li></ul>")).toMatch(/<ul\b[\s\S]*<li\b/);
  });

  test("keeps rel and dir, which the URI check was also stripping", () => {
    // Same root cause as `start`: a custom ALLOWED_URI_REGEXP is applied to every attribute DOMPurify
    // doesn't already treat as URI-safe, so non-URL attributes were dropped for failing a URL test.
    const sanitized = sanitizeFollowUpBody(
      '<p dir="rtl">מימין לשמאל <a href="https://example.com" rel="noopener">link</a></p>'
    );

    expect(sanitized).toContain('dir="rtl"');
    expect(sanitized).toContain('rel="noopener"');
  });

  test("keeps the author's inline formatting and http(s) links", () => {
    const sanitized = sanitizeFollowUpBody(
      '<p><strong>Bold</strong> <em>italic</em> <a href="https://example.com">link</a></p>'
    );

    expect(sanitized).toContain("<strong>Bold</strong>");
    expect(sanitized).toContain("<em>italic</em>");
    expect(sanitized).toContain('href="https://example.com"');
  });

  test("still strips script tags and non-http(s) schemes", () => {
    const sanitized = sanitizeFollowUpBody(
      '<p>hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
    );

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("<p>hi</p>");
  });

  test("still strips tags outside the allowlist, including the list-adjacent ones", () => {
    const sanitized = sanitizeFollowUpBody(
      "<div><h1>Heading</h1><table><tr><td>cell</td></tr></table></div>"
    );

    expect(sanitized).not.toMatch(/<(div|h1|table|tr|td)\b/);
    // KEEP_CONTENT: the text survives even though its tags do not.
    expect(sanitized).toContain("Heading");
  });
});
