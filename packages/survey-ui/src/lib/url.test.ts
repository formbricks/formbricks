import { describe, expect, test } from "vitest";
import { isSafeLinkUrl } from "./url";

describe("isSafeLinkUrl", () => {
  // Regression (ENG-2411): a CTA `buttonUrl` comes from an editable survey field and used to be handed
  // straight to `window.open()`, where a `javascript:` URL executes on the survey's own origin.
  test.each([
    "javascript:alert(document.domain)",
    "JavaScript:alert(1)",
    // Obfuscated scheme: browsers strip the control character, so a `startsWith("javascript:")` check
    // misses this while `new URL()` normalizes it back to `javascript:`.
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/abc",
    "not a url",
    "",
    // Relative and protocol-relative values are not absolute link targets; the caller has no base to
    // resolve them against, and `//host` lands on another origin despite looking like a path.
    "/relative/path",
    "//attacker.example/file",
  ])("rejects %j", (url) => {
    expect(isSafeLinkUrl(url)).toBe(false);
  });

  test.each([
    "https://example.com",
    "http://example.com/path?a=b#c",
    "http://localhost:3000/survey",
    "mailto:hello@example.com",
    "tel:+123456789",
    // Leading/trailing whitespace is tolerated: it is trimmed before parsing, matching the schema.
    "  https://example.com  ",
  ])("accepts %j", (url) => {
    expect(isSafeLinkUrl(url)).toBe(true);
  });
});
