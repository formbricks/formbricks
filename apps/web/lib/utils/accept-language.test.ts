import { describe, expect, test } from "vitest";
import { MAX_BROWSER_LANGUAGE_CANDIDATES } from "@formbricks/i18n-utils/survey-language-match";
import { parseAcceptLanguage } from "./accept-language";

describe("parseAcceptLanguage", () => {
  test("returns nothing for a missing or empty header", () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(" , ,")).toEqual([]);
  });

  test("keeps header order when no weights are given", () => {
    expect(parseAcceptLanguage("de-DE,en")).toEqual(["de-DE", "en"]);
  });

  test("orders by q weight, header order breaking ties", () => {
    expect(parseAcceptLanguage("en;q=0.5, de-DE, fr;q=0.8, es;q=0.8")).toEqual(["de-DE", "fr", "es", "en"]);
  });

  test("tolerates whitespace around tags and parameters", () => {
    expect(parseAcceptLanguage("  de-DE ;  q = 0.9 ,\ten-US ")).toEqual(["en-US", "de-DE"]);
  });

  test("drops the wildcard", () => {
    expect(parseAcceptLanguage("*, de;q=0.5")).toEqual(["de"]);
    expect(parseAcceptLanguage("*")).toEqual([]);
  });

  test("drops entries the client marks as not acceptable", () => {
    expect(parseAcceptLanguage("de;q=0, en")).toEqual(["en"]);
    expect(parseAcceptLanguage("de;q=0.000")).toEqual([]);
  });

  test("drops malformed tags and malformed weights", () => {
    expect(parseAcceptLanguage("<script>, de-DE, 12, en-;q=1, fr;q=abc, it;q=1.5, es;q=, pt")).toEqual([
      "de-DE",
      "pt",
    ]);
  });

  test("accepts underscore separators", () => {
    expect(parseAcceptLanguage("de_DE")).toEqual(["de_DE"]);
  });

  test("deduplicates case-insensitively, keeping the most preferred spelling", () => {
    expect(parseAcceptLanguage("de-de;q=0.4, DE-DE, en")).toEqual(["DE-DE", "en"]);
  });

  test("caps the number of tags returned", () => {
    const header = Array.from({ length: 20 }, (_, index) => `x${String.fromCharCode(97 + index)}`).join(",");
    expect(parseAcceptLanguage(header)).toHaveLength(MAX_BROWSER_LANGUAGE_CANDIDATES);
  });

  test("bounds work on an oversized header and drops the entry it cut through", () => {
    const header = `de-DE,${"en-US,".repeat(500)}fr-FR`;
    const tags = parseAcceptLanguage(header);
    expect(tags).toEqual(["de-DE", "en-US"]);

    const cutMidTag = `${"a".repeat(1020)},de-DE`;
    expect(parseAcceptLanguage(cutMidTag)).toEqual([]);
  });
});
