import { describe, expect, test } from "vitest";
import type { TI18nString } from "../i18n";
import type { TSurveyLanguage } from "./types";
import { findLanguageCodesForDuplicateLabels } from "./validation";

describe("findLanguageCodesForDuplicateLabels", () => {
  const mockLanguages: TSurveyLanguage[] = [
    {
      default: true,
      enabled: true,
      language: { id: "en", code: "en", alias: null, createdAt: new Date(), updatedAt: new Date() },
    },
    {
      default: false,
      enabled: true,
      language: { id: "es", code: "es", alias: null, createdAt: new Date(), updatedAt: new Date() },
    },
  ];

  test("should handle undefined language values without throwing", () => {
    const labels: TI18nString[] = [
      { default: "Option 1", es: "Opción 1" },
      { default: "Option 2" }, // Missing 'es' key - this was causing the error
      { default: "Option 3", es: "Opción 3" },
    ];

    // This should not throw a TypeError
    expect(() => findLanguageCodesForDuplicateLabels(labels, mockLanguages)).not.toThrow();
  });

  test("should detect duplicates when labels are the same", () => {
    const labels: TI18nString[] = [
      { default: "Option 1", es: "Opción 1" },
      { default: "Option 1", es: "Opción 1" }, // Duplicate
      { default: "Option 3", es: "Opción 3" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toContain("default");
    expect(result).toContain("es");
  });

  test("should not detect duplicates when labels are different", () => {
    const labels: TI18nString[] = [
      { default: "Option 1", es: "Opción 1" },
      { default: "Option 2", es: "Opción 2" },
      { default: "Option 3", es: "Opción 3" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toHaveLength(0);
  });

  test("should ignore empty strings when detecting duplicates", () => {
    const labels: TI18nString[] = [
      { default: "Option 1", es: "Opción 1" },
      { default: "", es: "" }, // Empty strings
      { default: "  ", es: "  " }, // Whitespace-only strings
      { default: "Option 2", es: "Opción 2" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toHaveLength(0);
  });

  test("should handle mixed scenarios with undefined and duplicates", () => {
    const labels: TI18nString[] = [
      { default: "Option 1" }, // Missing 'es'
      { default: "Option 2", es: "Opción" },
      { default: "Option 2", es: "Opción" }, // Duplicate in both languages
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toContain("default");
    expect(result).toContain("es");
  });

  test("should work with only default language enabled", () => {
    const defaultOnlyLanguages: TSurveyLanguage[] = [
      {
        default: true,
        enabled: true,
        language: { id: "en", code: "en", alias: null, createdAt: new Date(), updatedAt: new Date() },
      },
    ];

    const labels: TI18nString[] = [
      { default: "Option 1" },
      { default: "Option 1" }, // Duplicate
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, defaultOnlyLanguages);
    expect(result).toContain("default");
  });

  test("should handle completely undefined values gracefully", () => {
    const labels: TI18nString[] = [
      { default: "Option 1" },
      { default: "Option 2" },
      {} as TI18nString, // Empty object - all languages undefined
    ];

    // This should not throw
    expect(() => findLanguageCodesForDuplicateLabels(labels, mockLanguages)).not.toThrow();
    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toHaveLength(0);
  });
});
