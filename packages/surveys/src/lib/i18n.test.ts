import { describe, expect, test } from "vitest";
import { TI18nString } from "@formbricks/types/surveys/types";
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
  });
});
