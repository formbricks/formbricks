import { describe, expect, it } from "vitest";
import type { TI18nString } from "../i18n";
import type { TSurveyLanguage } from "./types";
import { findLanguageCodesForDuplicateLabels } from "./validation";

describe("findLanguageCodesForDuplicateLabels", () => {
  const mockLanguages: TSurveyLanguage[] = [
    {
      default: true,
      enabled: true,
      language: { code: "en", alias: "English" },
    },
    {
      default: false,
      enabled: true,
      language: { code: "es", alias: "Spanish" },
    },
  ];

  it("should handle labels with undefined language properties without throwing", () => {
    const labels: TI18nString[] = [
      { default: "Row 1", es: "Fila 1" },
      { default: "Row 2" }, // Missing 'es' property
      { default: "Row 3", es: "Fila 3" },
    ];

    // Should not throw TypeError
    expect(() => findLanguageCodesForDuplicateLabels(labels, mockLanguages)).not.toThrow();

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toEqual([]);
  });

  it("should detect duplicate labels when all translations are present", () => {
    const labels: TI18nString[] = [
      { default: "Option A", es: "Opción A" },
      { default: "Option B", es: "Opción B" },
      { default: "Option A", es: "Opción C" }, // Duplicate in default language
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toContain("default");
    expect(result).not.toContain("es");
  });

  it("should detect duplicate labels in specific languages", () => {
    const labels: TI18nString[] = [
      { default: "Option A", es: "Opción A" },
      { default: "Option B", es: "Opción A" }, // Duplicate in Spanish
      { default: "Option C", es: "Opción C" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toContain("es");
    expect(result).not.toContain("default");
  });

  it("should ignore empty strings when checking duplicates", () => {
    const labels: TI18nString[] = [
      { default: "", es: "" },
      { default: "", es: "" },
      { default: "Option A", es: "Opción A" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toEqual([]);
  });

  it("should handle labels with only whitespace", () => {
    const labels: TI18nString[] = [
      { default: "  ", es: "  " },
      { default: "   ", es: "   " },
      { default: "Option A", es: "Opción A" },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toEqual([]);
  });

  it("should trim labels before comparing for duplicates", () => {
    const labels: TI18nString[] = [
      { default: "  Option A  ", es: "Opción A" },
      { default: "Option A", es: "  Opción A  " },
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, mockLanguages);
    expect(result).toContain("default");
    expect(result).toContain("es");
  });

  it("should work with disabled languages", () => {
    const languagesWithDisabled: TSurveyLanguage[] = [
      {
        default: true,
        enabled: true,
        language: { code: "en", alias: "English" },
      },
      {
        default: false,
        enabled: false, // Disabled
        language: { code: "es", alias: "Spanish" },
      },
    ];

    const labels: TI18nString[] = [
      { default: "Option A", es: "Opción A" },
      { default: "Option A", es: "Opción A" }, // Duplicate in both languages
    ];

    const result = findLanguageCodesForDuplicateLabels(labels, languagesWithDisabled);
    // Should only check enabled languages
    expect(result).toContain("default");
    expect(result).not.toContain("es");
  });

  it("should handle matrix row/column scenario from the bug report", () => {
    // Simulating the scenario where a user deletes a matrix row/column
    // and validation is triggered with some labels missing translations
    const matrixRowLabels: TI18nString[] = [
      { default: "Row 1", es: "Fila 1" },
      { default: "Row 2" }, // Missing Spanish translation (undefined)
      { default: "Row 3", es: undefined as unknown as string }, // Explicitly undefined
    ];

    // This should not throw TypeError: Cannot read properties of undefined (reading 'trim')
    expect(() => findLanguageCodesForDuplicateLabels(matrixRowLabels, mockLanguages)).not.toThrow();

    const result = findLanguageCodesForDuplicateLabels(matrixRowLabels, mockLanguages);
    expect(result).toEqual([]);
  });
});
