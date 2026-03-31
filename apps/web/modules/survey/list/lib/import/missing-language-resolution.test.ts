import { describe, expect, test, vi } from "vitest";
import { resolveMissingProjectLanguages } from "./missing-language-resolution";

describe("resolveMissingProjectLanguages", () => {
  test("returns no-op when all imported languages already exist", async () => {
    const result = await resolveMissingProjectLanguages({
      importedLanguageCodes: ["en", "de"],
      existingLanguageCodes: ["en", "de", "fr"],
      hasManagePermission: true,
      createLanguage: vi.fn(),
      refreshExistingLanguageCodes: vi.fn(async () => ["en", "de", "fr"]),
      getLanguageNames: (codes) => codes,
    });

    expect(result).toEqual({ createdLanguageCodes: [] });
  });

  test("returns permission guidance when manage permission is missing", async () => {
    const result = await resolveMissingProjectLanguages({
      importedLanguageCodes: ["en", "de"],
      existingLanguageCodes: ["en"],
      hasManagePermission: false,
      createLanguage: vi.fn(),
      refreshExistingLanguageCodes: vi.fn(async () => ["en"]),
      getLanguageNames: (codes) => codes.map((code) => `language-${code}`),
    });

    expect(result.createdLanguageCodes).toEqual([]);
    expect(result.errorMessage).toContain("language-de");
    expect(result.errorMessage).toContain("manage permissions");
  });

  test("creates missing languages when permission is available", async () => {
    const createLanguage = vi.fn(async () => undefined);
    const refreshExistingLanguageCodes = vi.fn(async () => ["en", "de", "fr"]);

    const result = await resolveMissingProjectLanguages({
      importedLanguageCodes: ["en", "de", "fr"],
      existingLanguageCodes: ["en"],
      hasManagePermission: true,
      createLanguage,
      refreshExistingLanguageCodes,
      getLanguageNames: (codes) => codes,
    });

    expect(createLanguage).toHaveBeenCalledTimes(2);
    expect(createLanguage).toHaveBeenNthCalledWith(1, "de");
    expect(createLanguage).toHaveBeenNthCalledWith(2, "fr");
    expect(refreshExistingLanguageCodes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ createdLanguageCodes: ["de", "fr"] });
  });

  test("returns actionable error when some languages remain unresolved after creation", async () => {
    const createLanguage = vi.fn(async (code: string) => {
      if (code === "fr") {
        throw new Error("create failed");
      }
    });

    const result = await resolveMissingProjectLanguages({
      importedLanguageCodes: ["en", "de", "fr"],
      existingLanguageCodes: ["en"],
      hasManagePermission: true,
      createLanguage,
      refreshExistingLanguageCodes: vi.fn(async () => ["en", "de"]),
      getLanguageNames: (codes) => codes.map((code) => `language-${code}`),
    });

    expect(result.createdLanguageCodes).toEqual(["de"]);
    expect(result.errorMessage).toContain("language-fr");
    expect(result.errorMessage).toContain("Please add them in Project Configuration");
  });
});
