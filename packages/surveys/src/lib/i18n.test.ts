import { describe, expect, test } from "vitest";
import { TI18nString } from "@formbricks/types/i18n";
import { getLocalizedValue } from "./i18n";

describe("i18n", () => {
  describe("getLocalizedValue", () => {
    test("should return empty string for undefined value", () => {
      expect(getLocalizedValue(undefined, "en")).toBe("");
    });
    test("should return empty string for empty string", () => {
      expect(getLocalizedValue({ default: "" }, "en")).toBe("");
    });

    test("should return empty string for non-i18n string", () => {
      expect(getLocalizedValue("not an i18n string" as any, "en")).toBe("");
    });

    test("should return default value when language not found", () => {
      const i18nString: TI18nString = {
        default: "Default text",
        en: "English text",
      };
      expect(getLocalizedValue(i18nString, "fr")).toBe("Default text");
    });

    test("should return localized value when language found", () => {
      const i18nString: TI18nString = {
        default: "Default text",
        en: "English text",
        fr: "French text",
      };
      expect(getLocalizedValue(i18nString, "fr")).toBe("French text");
    });

    test("should fall back to default when the requested language key is an empty string", () => {
      const i18nString: TI18nString = {
        default: "Default text",
        "en-GB": "",
      };
      expect(getLocalizedValue(i18nString, "en-GB")).toBe("Default text");
    });

    test("should fall back to default when the requested language key is whitespace-only", () => {
      const i18nString: TI18nString = {
        default: "Default text",
        "en-GB": "   ",
      };
      expect(getLocalizedValue(i18nString, "en-GB")).toBe("Default text");
    });

    test("should still return the localized value when it is a non-empty string", () => {
      const i18nString: TI18nString = {
        default: "Default text",
        "en-GB": "British text",
      };
      expect(getLocalizedValue(i18nString, "en-GB")).toBe("British text");
    });
  });
});
