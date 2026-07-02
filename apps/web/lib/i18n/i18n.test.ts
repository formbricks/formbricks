import { describe, expect, test } from "vitest";
import { createI18nString, toLegacyLanguageCodes } from "./utils";

describe("createI18nString", () => {
  test("should create an i18n string from a regular string", () => {
    const result = createI18nString("Hello", ["default"]);
    expect(result).toEqual({ default: "Hello" });
  });

  test("should create a new i18n string with i18n enabled from a previous i18n string", () => {
    const result = createI18nString({ default: "Hello" }, ["default", "es"]);
    expect(result).toEqual({ default: "Hello", es: "" });
  });

  test("should add a new field key value pair when a new language is added", () => {
    const i18nObject = { default: "Hello", es: "Hola" };
    const newLanguages = ["default", "es", "de"];
    const result = createI18nString(i18nObject, newLanguages);
    expect(result).toEqual({
      default: "Hello",
      es: "Hola",
      de: "",
    });
  });

  test("should remove the translation that are not present in newLanguages", () => {
    const i18nObject = { default: "Hello", es: "hola" };
    const newLanguages = ["default"];
    const result = createI18nString(i18nObject, newLanguages);
    expect(result).toEqual({
      default: "Hello",
    });
  });
});

describe("toLegacyLanguageCodes", () => {
  test("maps a canonical code to its known legacy aliases", () => {
    expect(toLegacyLanguageCodes("de-DE")).toEqual(["de"]);
    expect(toLegacyLanguageCodes("zh-Hans-CN")).toEqual(["zh", "zh-CN", "zh-Hans"]);
  });

  test("returns an empty array for a code with no legacy aliases", () => {
    expect(toLegacyLanguageCodes("xx-YY")).toEqual([]);
  });

  test("returns a fresh copy so a caller can't corrupt the shared cache", () => {
    const aliases = toLegacyLanguageCodes("de-DE");
    aliases.push("MUTATED");
    // A later lookup must be unaffected by the mutation above.
    expect(toLegacyLanguageCodes("de-DE")).toEqual(["de"]);
  });
});
