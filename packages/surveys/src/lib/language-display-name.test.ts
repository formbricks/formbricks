import { describe, expect, test } from "vitest";
import { getLanguageDisplayName } from "./language-display-name";

describe("getLanguageDisplayName", () => {
  test("returns native name for common language codes", () => {
    expect(getLanguageDisplayName("de")).toBe("Deutsch");
    expect(getLanguageDisplayName("fr")).toBe("français");
    expect(getLanguageDisplayName("es")).toBe("español");
    expect(getLanguageDisplayName("ja")).toBe("日本語");
    expect(getLanguageDisplayName("ko")).toBe("한국어");
    expect(getLanguageDisplayName("ar")).toBe("العربية");
    expect(getLanguageDisplayName("en")).toBe("English");
  });

  test("returns native name for regional variants", () => {
    expect(getLanguageDisplayName("pt-BR")).toBe("português (Brasil)");
    expect(getLanguageDisplayName("de-AT")).toBe("Österreichisches Deutsch");
    expect(getLanguageDisplayName("fr-CA")).toBe("français canadien");
    expect(getLanguageDisplayName("zh-Hans")).toBe("简体中文");
    expect(getLanguageDisplayName("zh-Hant")).toBe("繁體中文");
  });

  test("returns native name for less common codes", () => {
    expect(getLanguageDisplayName("aa")).toBe("Afar");
    expect(getLanguageDisplayName("is")).toBe("íslenska");
    expect(getLanguageDisplayName("cy")).toBe("Cymraeg");
    expect(getLanguageDisplayName("eu")).toBe("euskara");
    expect(getLanguageDisplayName("vo")).toBe("Volapük");
    expect(getLanguageDisplayName("bo")).toBe("བོད་སྐད་");
  });

  test("returns raw code for unknown codes", () => {
    expect(getLanguageDisplayName("xx")).toBe("xx");
    expect(getLanguageDisplayName("unknown")).toBe("unknown");
  });

  test("returns empty string for empty input", () => {
    expect(getLanguageDisplayName("")).toBe("");
  });
});
