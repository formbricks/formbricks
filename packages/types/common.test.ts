import { describe, expect, test } from "vitest";
import { ZEndingCardButtonLink, ZEndingCardUrl, isEmailAddressShape } from "./common";

const isValid = (url: string): boolean => ZEndingCardUrl.safeParse(url).success;

// ENG-2585: the ending card's button URL and redirect URL only had to start with http(s)://, so
// "http://google" or "https://" saved and sent respondents nowhere. Hidden-field URLs (#7139) still
// have to pass: a host that is a recall value can only be checked once the survey runs.
describe("ZEndingCardUrl", () => {
  test.each([
    "https://example.com",
    "http://example.com/thanks?id=1#top",
    "https://sub.example.co.uk/path",
    " https://example.com ",
    "https://xn--bcher-kva.example",
    "https://bücher.example",
    "http://localhost:3000/done",
    "http://192.168.0.1/done",
    "http://[::1]:8080/",
  ])("accepts %s", (url) => {
    expect(isValid(url)).toBe(true);
  });

  test.each([
    ["http://google", "no top-level domain"],
    ["https://", "no host"],
    ["https://.com", "empty label"],
    ["https://example.", "empty top-level domain"],
    ["https://-example.com", "label starting with a hyphen"],
    ["https://exa mple.com", "space in the host"],
    ["https://example.c", "one-letter top-level domain"],
    ["https://example.123", "numeric top-level domain"],
    ["ftp://example.com", "wrong protocol"],
    ["example.com", "no protocol"],
    ["https://google#recall:", "incomplete recall token after an invalid host"],
    ["https://#recall:test123/fallback:example.com", "recall token without its closing #"],
    ["https://google#recall:id/fallback:#", "host completed by an empty fallback"],
    ["https://#recall:id/fallback:google#", "fallback that is not a web address"],
  ])("rejects %s (%s)", (url) => {
    expect(isValid(url)).toBe(false);
  });

  test.each([
    "https://#recall:url123/fallback:example.com#",
    "https://example.com/?user=#recall:uid/fallback:anonymous#",
    "https://example.com/#recall:path/fallback:#",
    "https://foo#recall:id/fallback:.example.com#",
    "https://#recall:url123/fallback:#",
  ])("accepts a hidden-field URL: %s", (url) => {
    expect(isValid(url)).toBe(true);
  });
});

describe("ZEndingCardButtonLink", () => {
  test("accepts http(s) links, including recall placeholders", () => {
    expect(ZEndingCardButtonLink.safeParse("https://formbricks.com").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse("http://example.com").success).toBe(true);
    expect(ZEndingCardButtonLink.safeParse("https://#recall:id/fallback:example.com#").success).toBe(true);
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

  test("applies the ending-card web address check to http(s) links", () => {
    const result = ZEndingCardButtonLink.safeParse("http://google");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("URL must be a valid web address, like https://example.com");
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
