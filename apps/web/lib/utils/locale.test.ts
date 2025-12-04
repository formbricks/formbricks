import * as nextHeaders from "next/headers";
import { describe, expect, test, vi } from "vitest";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { appLanguages } from "@/lib/i18n/utils";
import { findMatchingLocale } from "./locale";

// Mock the Next.js headers function
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("locale", () => {
  test("returns DEFAULT_LOCALE when Accept-Language header is missing", async () => {
    // Set up the mock to return null for accept-language header
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns exact match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES
    const testLocale = AVAILABLE_LOCALES[0];

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(`${testLocale},fr-FR,de-DE`),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(testLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns normalized match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES but not 'en-GB'
    const availableLocale = AVAILABLE_LOCALES.find((locale) => locale.startsWith("en-"));

    if (!availableLocale) {
      // Skip this test if no English locale is available
      return;
    }

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("en-US,fr-FR,de-DE"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(availableLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns DEFAULT_LOCALE when no match is found", async () => {
    // Use a locale that should not exist in AVAILABLE_LOCALES
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("xx-XX,yy-YY"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("handles multiple potential matches correctly", async () => {
    // If we have multiple locales for the same language, it should return the first match
    const germanLocale = AVAILABLE_LOCALES.find((locale) => locale.toLowerCase().startsWith("de"));

    if (!germanLocale) {
      // Skip this test if no German locale is available
      return;
    }

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("de-DE,en-US,fr-FR"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(germanLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("Swedish locale (sv-SE) is available and selectable", async () => {
    // Verify sv-SE is in AVAILABLE_LOCALES
    expect(AVAILABLE_LOCALES).toContain("sv-SE");

    // Verify Swedish has a language entry with proper labels
    const swedishLanguage = appLanguages.find((lang) => lang.code === "sv-SE");
    expect(swedishLanguage).toBeDefined();
    expect(swedishLanguage?.label["en-US"]).toBe("Swedish");
    expect(swedishLanguage?.label["sv-SE"]).toBe("Svenska");

    // Verify the locale can be matched from Accept-Language header
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("sv-SE,en-US"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe("sv-SE");
    expect(nextHeaders.headers).toHaveBeenCalled();
  });
});
