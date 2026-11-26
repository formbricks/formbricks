import { describe, expect, test } from "vitest";
import type { TI18nString } from "@formbricks/types/i18n";
import {
  createI18nString,
  getLocalizedValue,
  isLabelValidForAllLanguages,
  toLegacyLanguageCodes,
} from "./utils";

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

  // ENG-3726 sibling: the reverse index must not answer for inherited Object.prototype members.
  test.each(["constructor", "toString", "hasOwnProperty", "__proto__"])(
    "returns an empty array for the Object.prototype member %j",
    (code) => {
      expect(toLegacyLanguageCodes(code)).toEqual([]);
    }
  );

  test("returns a fresh copy so a caller can't corrupt the shared cache", () => {
    const aliases = toLegacyLanguageCodes("de-DE");
    aliases.push("MUTATED");
    // A later lookup must be unaffected by the mutation above.
    expect(toLegacyLanguageCodes("de-DE")).toEqual(["de"]);
  });
});

// ENG-3726: the response language is caller-supplied on public routes (v2 client responses validate
// "other" option text with the raw value), so an Object.prototype member name must read as "no
// translation", never as an inherited function.
describe("prototype member names as language codes", () => {
  const label = { default: "Yes", "de-DE": "Ja" };

  test.each(["constructor", "toString", "hasOwnProperty", "__proto__"])(
    "getLocalizedValue treats %j as an untranslated language",
    (language) => {
      expect(getLocalizedValue(label, language)).toBe("");
    }
  );

  test.each(["constructor", "toString", "hasOwnProperty", "__proto__"])(
    "isLabelValidForAllLanguages reports %j as missing instead of throwing",
    (language) => {
      expect(isLabelValidForAllLanguages(label, ["default", language])).toBe(false);
    }
  );

  test("still reads own translations", () => {
    expect(getLocalizedValue(label, "de-DE")).toBe("Ja");
    expect(isLabelValidForAllLanguages(label, ["default", "de-DE"])).toBe(true);
  });
});

// A stored label is JSON the type cannot vouch for; a non-string entry reads as untranslated rather than
// reaching a caller that calls `.trim()` on it.
describe("non-string translations", () => {
  const malformed = JSON.parse('{"default":"Yes","de-DE":5,"fr-FR":{"text":"Oui"}}') as TI18nString;

  test.each(["de-DE", "fr-FR"])("getLocalizedValue reads the %s entry as untranslated", (language) => {
    expect(getLocalizedValue(malformed, language)).toBe("");
  });

  test.each(["de-DE", "fr-FR"])("isLabelValidForAllLanguages reports the %s entry as missing", (language) => {
    expect(isLabelValidForAllLanguages(malformed, ["default", language])).toBe(false);
  });
});
