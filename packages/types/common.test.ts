import { describe, expect, test } from "vitest";
import { ZEndingCardButtonLink, ZEndingCardUrl, isEmailAddressShape } from "./common";

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

  test("accepts recipient lists and recipients filled in from a recall value", () => {
    expect(ZEndingCardButtonLink.safeParse("mailto:a@example.com,b@example.org").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse("mailto:#recall:email/fallback:hi@example.com#").success).toBe(
      true
    );
  });

  test("rejects a mailto: link without a valid recipient", () => {
    for (const url of [
      "mailto:",
      "mailto:?subject=Hello",
      "mailto:not-an-email",
      "mailto:@example.com",
      "mailto:hello@example",
      "mailto:hello@example.",
      "mailto:a@example.com,",
      "mailto:%E0@example.com",
      "mailto:a@example.c",
      "mailto:not-an-email#recall:",
      "mailto:#recall:#",
      "mailto:#recall:/fallback:x#",
      "mailto:#recall:email#",
      "mailto:#recall:em ail/fallback:x#",
      "mailto:#recall:email/fallback:not-an-email#",
      "mailto:#recall:email/fallback:#",
      "mailto:a@b@example.com",
    ]) {
      const result = ZEndingCardButtonLink.safeParse(url);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("mailto: link must include a valid email address");
    }
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

describe("isEmailAddressShape", () => {
  test("accepts a single address with a dotted domain", () => {
    expect(isEmailAddressShape("hello@example.com")).toBe(true);
    expect(isEmailAddressShape("first.last+tag@sub.example.org")).toBe(true);
  });

  test("rejects anything else", () => {
    for (const value of [
      "",
      "hello",
      "@example.com",
      "a@b@example.com",
      "a@example",
      "a@example.c",
      "a b@example.com",
    ]) {
      expect(isEmailAddressShape(value)).toBe(false);
    }
  });
});
