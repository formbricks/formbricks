import { describe, expect, test } from "vitest";

import { getLanguageLabel } from "./utils";

describe("getLanguageLabel", () => {
  test("returns locale specific label when available", () => {
    expect(getLanguageLabel("de", "de-DE")).toBe("Deutsch");
  });

  test("falls back to English when locale specific label is missing", () => {
    // Language "aa" (Afar) does not currently ship with a Dutch translation.
    expect(getLanguageLabel("aa", "nl-NL")).toBe("Afar");
  });

  test("returns undefined for unknown language codes", () => {
    expect(getLanguageLabel("zz", "en-US")).toBeUndefined();
  });
});
