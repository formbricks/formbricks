import { describe, expect, test } from "vitest";
import { DEFAULT_ENDING_CARD_BUTTON_LINK, isDefaultEndingCardButtonLink } from "./default-ending-card";

describe("isDefaultEndingCardButtonLink", () => {
  test("matches the product-provided default CTA link", () => {
    expect(isDefaultEndingCardButtonLink(DEFAULT_ENDING_CARD_BUTTON_LINK)).toBe(true);
  });

  test.each([
    ["no link", undefined],
    ["null link", null],
    ["bare formbricks host", "https://formbricks.com"],
    [
      "changed path",
      "https://formbricks.com/phish?utm_source=formbricks-app&utm_medium=survey&utm_campaign=default_ending_cta",
    ],
    ["changed parameter", DEFAULT_ENDING_CARD_BUTTON_LINK.replace("default_ending_cta", "other")],
    ["appended parameter", `${DEFAULT_ENDING_CARD_BUTTON_LINK}&redirect=https://evil.example`],
    [
      "lookalike host",
      DEFAULT_ENDING_CARD_BUTTON_LINK.replace("formbricks.com", "formbricks.com.evil.example"),
    ],
    ["http scheme", DEFAULT_ENDING_CARD_BUTTON_LINK.replace("https://", "http://")],
  ])("rejects %s", (_, link) => {
    expect(isDefaultEndingCardButtonLink(link)).toBe(false);
  });
});
