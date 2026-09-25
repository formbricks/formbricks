import { describe, expect, test } from "vitest";
import { ZEndingCardButtonLink, ZEndingCardUrl } from "./common";

describe("ZEndingCardButtonLink", () => {
  test("accepts http(s) links, including recall placeholders", () => {
    expect(ZEndingCardButtonLink.safeParse("https://formbricks.com").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse("http://example.com").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse("https://#recall:id/fallback:example.com").success).toBe(true);
  });

  test("accepts mailto: links", () => {
    expect(ZEndingCardButtonLink.safeParse("mailto:hello@felofish.com").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse(" mailto:hello@felofish.com?subject=Hi ").success).toBe(true);
  });

  test("rejects a mailto: link with no address", () => {
    const result = ZEndingCardButtonLink.safeParse("mailto:");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("mailto: link must include an email address");
  });

  test("rejects other schemes", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "tel:+123", "example.com"]) {
      const result = ZEndingCardButtonLink.safeParse(url);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("URL must start with http://, https:// or mailto:");
    }
  });

  test("leaves redirect URLs http(s)-only", () => {
    expect(ZEndingCardUrl.safeParse("mailto:hello@felofish.com").success).toBe(false);
  });
});
