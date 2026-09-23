import { describe, expect, test } from "vitest";
import { TI18nString } from "@formbricks/types/i18n";
import { getLocalizedValue, getTranslations } from "./i18n";
import i18n from "./i18n.config";

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

  describe("getTranslations", () => {
    // getTranslations also switches the shared instance the survey chrome reads from. Handed the raw
    // tag, i18next resolves Traditional Chinese to the first `zh-*` bundle — Simplified.
    test("switches a Traditional Chinese tag to the Traditional bundle", () => {
      i18n.addResourceBundle("zh-Hant-TW", "translation", { common: { required: "必填" } });
      i18n.addResourceBundle("zh-Hans-CN", "translation", { common: { required: "必填项" } });
      try {
        expect(getTranslations("zh-HK")("common.required")).toBe("必填");
        expect(i18n.language).toBe("zh-Hant-TW");
        expect(i18n.t("common.required")).toBe("必填");
      } finally {
        void i18n.changeLanguage("en-US");
        i18n.removeResourceBundle("zh-Hant-TW", "translation");
        i18n.removeResourceBundle("zh-Hans-CN", "translation");
      }
    });
  });
});
