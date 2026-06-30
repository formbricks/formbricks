import { describe, expect, test } from "vitest";
import { escapeHtml, isValidEmail } from "./escape";

describe("escapeHtml", () => {
  test("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;"
    );
  });

  test("leaves a plain string untouched", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("isValidEmail", () => {
  test.each(["jane@example.com", "  jane@example.com  ", "a.b+tag@sub.example.co"])("accepts %s", (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  test.each(["", "not-an-email", "jane@", "@example.com", "a@b@c.com", "jane@ex ample.com", "jane@example"])(
    "rejects %s",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    }
  );
});
