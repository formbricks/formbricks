import { describe, expect, test } from "vitest";
import { LINK_ATTRIBUTES, MATCHERS } from "./auto-link-matchers";

const [matchUrl, matchEmail] = MATCHERS;

describe("auto-link matchers", () => {
  describe("URL matcher", () => {
    test.each([
      ["https://formbricks.com", "https://formbricks.com"],
      ["http://formbricks.com/path?a=1", "http://formbricks.com/path?a=1"],
      ["www.formbricks.com", "www.formbricks.com"],
    ])("auto-links %s so it opens in a new tab", (input, expectedUrl) => {
      const match = matchUrl(input);

      expect(match).not.toBeNull();
      expect(match?.url).toBe(expectedUrl);
      // Auto-linked URLs must carry the same attributes the link toolbar applies,
      // otherwise following one mid-survey navigates the respondent away from their
      // in-progress response.
      expect(match?.attributes).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    });

    test("reports the offset and length of a URL inside surrounding text", () => {
      const match = matchUrl("visit https://formbricks.com now");

      expect(match).toMatchObject({
        index: 6,
        length: "https://formbricks.com".length,
        text: "https://formbricks.com",
        attributes: LINK_ATTRIBUTES,
      });
    });

    test("returns null when there is no URL", () => {
      expect(matchUrl("no link in here")).toBeNull();
    });
  });

  describe("email matcher", () => {
    test("auto-links an email address as mailto and keeps the current tab", () => {
      const match = matchEmail("hi@formbricks.com");

      expect(match).toMatchObject({
        index: 0,
        length: "hi@formbricks.com".length,
        text: "hi@formbricks.com",
        url: "mailto:hi@formbricks.com",
      });
      // No target/rel: handing off to the mail client must not open a blank tab.
      expect(match?.attributes).toBeUndefined();
    });

    test("returns null when there is no email address", () => {
      expect(matchEmail("no address in here")).toBeNull();
    });

    // The local part is capped at RFC 5321's 64 so a long run of local-part characters cannot be
    // rescanned from every start position. A cap on its own is not enough: `\b` also sits between a
    // word character and `+`, `-`, `%` or `.`, so the match could restart INSIDE an overlong local
    // part and link a different address than the one written. These pin "no link" rather than
    // "a link to something else".
    test.each([
      ["plus", "a+"],
      ["dot", "a."],
      ["hyphen", "a-"],
      ["percent", "a%"],
      ["underscore", "a_"],
    ])("does not link a truncated suffix of an overlong local part (%s)", (_label, unit) => {
      // 32 repeats + a trailing "a" is a 65-character local part, one over the cap, with an
      // interior word boundary after every punctuation character.
      const overlong = `${unit.repeat(32)}a@example.com`;

      expect(matchEmail(overlong)).toBeNull();
    });

    test("links a local part exactly at the 64-character cap", () => {
      const atCap = `${"a".repeat(64)}@example.com`;

      expect(matchEmail(atCap)).toMatchObject({ index: 0, text: atCap });
    });

    test("keeps linking ordinary addresses that contain local-part punctuation", () => {
      for (const address of [
        "first.last+tag@sub.example.co.uk",
        "user_name@example.org",
        "user-name@example-host.io",
        "percent%sign@example.com",
      ]) {
        expect(matchEmail(address)).toMatchObject({ index: 0, text: address });
      }
    });
  });
});
