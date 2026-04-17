// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { isValidHTML, stripInlineStyles } from "./html-utils";

describe("html-utils", () => {
  describe("stripInlineStyles", () => {
    test("should remove inline styles with double quotes", () => {
      const input = '<div style="color: red;">Test</div>';
      const expected = "<div>Test</div>";
      expect(stripInlineStyles(input)).toBe(expected);
    });

    test("should remove inline styles with single quotes", () => {
      const input = "<div style='color: red;'>Test</div>";
      const expected = "<div>Test</div>";
      expect(stripInlineStyles(input)).toBe(expected);
    });

    test("should remove multiple inline styles", () => {
      const input = '<div style="color: red;"><span style="font-size: 14px;">Test</span></div>';
      const expected = "<div><span>Test</span></div>";
      expect(stripInlineStyles(input)).toBe(expected);
    });

    test("should handle complex inline styles", () => {
      const input = '<p style="margin: 10px; padding: 5px; background-color: blue;">Content</p>';
      const expected = "<p>Content</p>";
      expect(stripInlineStyles(input)).toBe(expected);
    });

    test("should not affect other attributes", () => {
      const input = '<div class="test" id="myDiv" style="color: red;">Test</div>';
      const expected = '<div class="test" id="myDiv">Test</div>';
      expect(stripInlineStyles(input)).toBe(expected);
    });

    test("should return unchanged string if no inline styles", () => {
      const input = '<div class="test">Test</div>';
      expect(stripInlineStyles(input)).toBe(input);
    });

    test("should handle empty string", () => {
      expect(stripInlineStyles("")).toBe("");
    });

    test("should remove script tags and dangerous event handler attributes", () => {
      const input =
        '<script>alert("x")</script><img src="x" onerror="alert(1)" /><a href="https://example.com" target="_blank" onclick="alert(1)" style="color:red">Go</a>';
      const sanitized = stripInlineStyles(input);

      expect(sanitized).not.toContain("<script");
      expect(sanitized).not.toContain("</script>");
      expect(sanitized).not.toContain("onerror=");
      expect(sanitized).not.toContain("onclick=");
      expect(sanitized).not.toContain("style=");
      expect(sanitized).toContain('target="_blank"');
    });
  });

  describe("isValidHTML", () => {
    test("should return false for empty string", () => {
      expect(isValidHTML("")).toBe(false);
    });

    test("should return false for plain text", () => {
      expect(isValidHTML("Hello World")).toBe(false);
    });

    test("should return true for HTML with tags", () => {
      expect(isValidHTML("<p>Hello</p>")).toBe(true);
    });

    test("should return true for HTML with formatting", () => {
      expect(isValidHTML("<p><strong>Bold text</strong></p>")).toBe(true);
    });

    test("should return true for complex HTML", () => {
      expect(isValidHTML('<div class="test"><p>Test</p></div>')).toBe(true);
    });

    test("should handle HTML with inline styles (they should be stripped)", () => {
      expect(isValidHTML('<p style="color: red;">Test</p>')).toBe(true);
    });
  });
});
