import { enUS } from "date-fns/locale/en-US";
import { describe, expect, test } from "vitest";
import { loadLocale } from "./locale";

describe("loadLocale", () => {
  test("should return enUS when localeCode is undefined", async () => {
    const result = await loadLocale(undefined);
    expect(result).toBe(enUS);
  });

  test("should return enUS when localeCode is empty string", async () => {
    const result = await loadLocale("");
    expect(result).toBe(enUS);
  });

  describe("special cases", () => {
    test("should load pt-BR for pt-BR locale", async () => {
      const result = await loadLocale("pt-BR");
      expect(result).toBeDefined();
      expect(result.code).toBe("pt-BR");
    });

    test("should load pt-BR for pt-br (lowercase)", async () => {
      const result = await loadLocale("pt-br");
      expect(result).toBeDefined();
      expect(result.code).toBe("pt-BR");
    });

    test("should load pt for pt locale", async () => {
      const result = await loadLocale("pt");
      expect(result).toBeDefined();
      expect(result.code).toBe("pt");
    });

    test("should load zh-CN for zh-hans", async () => {
      const result = await loadLocale("zh-hans");
      expect(result).toBeDefined();
      expect(result.code).toBe("zh-CN");
    });

    test("should load zh-CN for zh-cn", async () => {
      const result = await loadLocale("zh-cn");
      expect(result).toBeDefined();
      expect(result.code).toBe("zh-CN");
    });

    test("should load zh-TW for zh-hant", async () => {
      const result = await loadLocale("zh-hant");
      expect(result).toBeDefined();
      expect(result.code).toBe("zh-TW");
    });

    test("should load zh-TW for zh-tw", async () => {
      const result = await loadLocale("zh-tw");
      expect(result).toBeDefined();
      expect(result.code).toBe("zh-TW");
    });
  });

  describe("switch statement cases", () => {
    test("should load de for German locale", async () => {
      const result = await loadLocale("de");
      expect(result).toBeDefined();
      expect(result.code).toBe("de");
    });

    test("should load es for Spanish locale", async () => {
      const result = await loadLocale("es");
      expect(result).toBeDefined();
      expect(result.code).toBe("es");
    });

    test("should load fr for French locale", async () => {
      const result = await loadLocale("fr");
      expect(result).toBeDefined();
      expect(result.code).toBe("fr");
    });

    test("should load ja for Japanese locale", async () => {
      const result = await loadLocale("ja");
      expect(result).toBeDefined();
      expect(result.code).toBe("ja");
    });

    test("should load nl for Dutch locale", async () => {
      const result = await loadLocale("nl");
      expect(result).toBeDefined();
      expect(result.code).toBe("nl");
    });

    test("should load ro for Romanian locale", async () => {
      const result = await loadLocale("ro");
      expect(result).toBeDefined();
      expect(result.code).toBe("ro");
    });

    test("should load ar for Arabic locale", async () => {
      const result = await loadLocale("ar");
      expect(result).toBeDefined();
      expect(result.code).toBe("ar");
    });

    test("should load it for Italian locale", async () => {
      const result = await loadLocale("it");
      expect(result).toBeDefined();
      expect(result.code).toBe("it");
    });

    test("should load ru for Russian locale", async () => {
      const result = await loadLocale("ru");
      expect(result).toBeDefined();
      expect(result.code).toBe("ru");
    });

    test("should load uz for Uzbek locale", async () => {
      const result = await loadLocale("uz");
      expect(result).toBeDefined();
      expect(result.code).toBe("uz");
    });

    test("should load hi for Hindi locale", async () => {
      const result = await loadLocale("hi");
      expect(result).toBeDefined();
      expect(result.code).toBe("hi");
    });
  });

  describe("case insensitivity", () => {
    test("should handle uppercase locale codes", async () => {
      const result = await loadLocale("DE");
      expect(result).toBeDefined();
      expect(result.code).toBe("de");
    });

    test("should handle mixed case locale codes", async () => {
      const result = await loadLocale("Fr");
      expect(result).toBeDefined();
      expect(result.code).toBe("fr");
    });

    test("should handle locale codes with region", async () => {
      const result = await loadLocale("de-AT");
      expect(result).toBeDefined();
      expect(result.code).toBe("de");
    });
  });

  describe("fallback behavior", () => {
    test("should return enUS for unknown locale code", async () => {
      const result = await loadLocale("unknown");
      expect(result).toBe(enUS);
    });

    test("should return enUS for invalid locale code", async () => {
      const result = await loadLocale("xyz");
      expect(result).toBe(enUS);
    });
  });

  describe("error handling", () => {
    test("should fall back to enUS when locale code is invalid", async () => {
      const result = await loadLocale("invalid-locale-xyz");
      expect(result).toBe(enUS);
    });
  });
});
