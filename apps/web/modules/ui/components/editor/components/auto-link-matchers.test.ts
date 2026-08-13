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
  });
});
