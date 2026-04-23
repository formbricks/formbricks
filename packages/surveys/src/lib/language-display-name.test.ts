import { describe, expect, test } from "vitest";
import { getLanguageDisplayName } from "./language-display-name";

describe("getLanguageDisplayName", () => {
  test("returns native name for common language codes", () => {
    expect(getLanguageDisplayName("de")).toBe("Deutsch");
    expect(getLanguageDisplayName("fr")).toBe("Français");
    expect(getLanguageDisplayName("es")).toBe("Español");
    expect(getLanguageDisplayName("ja")).toBe("日本語");
    expect(getLanguageDisplayName("ko")).toBe("한국어");
    expect(getLanguageDisplayName("ar")).toBe("العربية");
    expect(getLanguageDisplayName("en")).toBe("English");
  });

  test("returns native name for regional variants", () => {
    expect(getLanguageDisplayName("pt-BR")).toBe("Português (Brasil)");
    expect(getLanguageDisplayName("de-AT")).toBe("Österreichisches Deutsch");
    expect(getLanguageDisplayName("fr-CA")).toBe("Français canadien");
    expect(getLanguageDisplayName("zh-Hans")).toBe("简体中文");
    expect(getLanguageDisplayName("zh-Hant")).toBe("繁體中文");
  });

  test("returns native name for less common codes", () => {
    expect(getLanguageDisplayName("aa")).toBe("Afar");
    expect(getLanguageDisplayName("is")).toBe("Íslenska");
    expect(getLanguageDisplayName("cy")).toBe("Cymraeg");
    expect(getLanguageDisplayName("eu")).toBe("Euskara");
    expect(getLanguageDisplayName("vo")).toBe("Volapük");
    expect(getLanguageDisplayName("bo")).toBe("བོད་སྐད་");
  });

  test("returns raw code for unknown codes", () => {
    expect(getLanguageDisplayName("xx")).toBe("Xx");
    expect(getLanguageDisplayName("unknown")).toBe("Unknown");
  });

  test("returns empty string for empty input", () => {
    expect(getLanguageDisplayName("")).toBe("");
  });
});
