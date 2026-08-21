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

  test("does not leak its link handling into later sanitize calls", () => {
    sanitizeSurveyHtml('<a href="https://example.com">Go</a>');

    expect(stripInlineStyles('<a href="https://example.com">Go</a>')).not.toContain("target=");
  });
});
