import { describe, expect, test } from "vitest";
// Kept out of `utils.test.ts`, which mocks isomorphic-dompurify away — these cases need
// the real sanitizer to prove what survives it.
import { sanitizeSurveyHtml, stripInlineStyles } from "./utils";

describe("sanitizeSurveyHtml", () => {
  test("opens a link pasted as plain text in a new tab", () => {
    const sanitized = sanitizeSurveyHtml('<p>Read the <a href="https://example.com">policy</a></p>');

    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
  });

  test("keeps links that already target a new tab", () => {
    const sanitized = sanitizeSurveyHtml('<a href="https://example.com" target="_blank">Go</a>');

    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
  });

  test("leaves an explicit same-tab target alone", () => {
    const sanitized = sanitizeSurveyHtml('<a href="https://example.com" target="_self">Go</a>');

    expect(sanitized).toContain('target="_self"');
    expect(sanitized).not.toContain("noopener");
  });

  test("strips inline styles and dangerous markup", () => {
    const sanitized = sanitizeSurveyHtml(
      '<script>alert("x")</script><a href="https://example.com" onclick="alert(1)" style="color:red">Go</a>'
    );

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick=");
    expect(sanitized).not.toContain("style=");
  });

  test("returns empty string unchanged", () => {
    expect(sanitizeSurveyHtml("")).toBe("");
  });

  test("drops <style>, images, forms and inputs that the default profile would keep", () => {
    const sanitized = sanitizeSurveyHtml(
      '<style>body{display:none}</style><img src="https://evil.example/x.png"><form action="https://evil.example"><input name="pw"></form><p>kept</p>'
    );

    expect(sanitized).toBe("<p>kept</p>");
  });

  test("drops links that are not http(s), mailto or tel", () => {
    expect(sanitizeSurveyHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeSurveyHtml('<a href="data:text/html,x">x</a>')).not.toContain("data:");
    expect(sanitizeSurveyHtml('<a href="mailto:a@b.co">m</a>')).toContain('href="mailto:a@b.co"');
    expect(sanitizeSurveyHtml('<a href="tel:+123">t</a>')).toContain('href="tel:+123"');
  });

  // Everything the rich-text editor can write (headings, lists, bold/italic/underline, links, nested
  // lists, RTL) must come through untouched, or an author's formatting silently disappears.
  test("keeps the formatting the rich-text editor produces", () => {
    const editorHtml =
      '<h1 class="fb-editor-heading-h1" dir="ltr"><span>Title</span></h1>' +
      '<h2 dir="ltr">Sub</h2>' +
      '<p class="fb-editor-paragraph" dir="rtl"><b><strong class="fb-editor-text-bold">bold</strong></b> <i><em class="fb-editor-text-italic">it</em></i> <u class="fb-editor-text-underline">u</u> <s>s</s> <mark>m</mark><br></p>' +
      '<ul class="fb-editor-list-ul"><li value="1" class="fb-editor-listitem">a</li><li class="fb-editor-nested-listitem"><ul><li value="1">n</li></ul></li></ul>' +
      '<ol start="3" class="fb-editor-list-ol"><li value="3">c</li></ol>' +
      "<blockquote><pre><code>q</code></pre></blockquote>" +
      '<p><a href="https://example.com/a?b=1&amp;c=2" class="fb-editor-link" target="_blank" rel="noopener noreferrer">link</a></p>';

    expect(sanitizeSurveyHtml(editorHtml)).toBe(editorHtml);
  });

  test("does not leak its link handling into later sanitize calls", () => {
    sanitizeSurveyHtml('<a href="https://example.com">Go</a>');

    expect(stripInlineStyles('<a href="https://example.com">Go</a>')).not.toContain("target=");
  });
});
