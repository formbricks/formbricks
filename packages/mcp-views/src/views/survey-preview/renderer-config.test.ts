import { describe, expect, test } from "vitest";
import { isHttpUrl, pickInitialLanguage, toRendererLanguage, toScriptUrl } from "./renderer-config";

const surveyLanguages = [
  { code: "en-US", default: true, enabled: true },
  { code: "de-DE", default: false, enabled: true, alias: "german" },
  { code: "fr-FR", default: false, enabled: false },
];
const renderLanguages = [
  { default: true, enabled: true, language: { code: "en-US" } },
  { default: false, enabled: true, language: { code: "de-DE" } },
];

describe("toRendererLanguage", () => {
  test("uses the renderer's default sentinel for the default language", () => {
    expect(toRendererLanguage("en-US", surveyLanguages, renderLanguages)).toBe("default");
  });

  test("uses the language's own code for the others, whatever the case", () => {
    expect(toRendererLanguage("de-DE", surveyLanguages, renderLanguages)).toBe("de-DE");
    expect(toRendererLanguage("DE-de", surveyLanguages, renderLanguages)).toBe("de-DE");
  });

  test("falls back to the default language for a code the renderer does not know", () => {
    expect(toRendererLanguage("fr-FR", surveyLanguages, renderLanguages)).toBe("default");
    expect(toRendererLanguage("xx", surveyLanguages, renderLanguages)).toBe("default");
  });
});

describe("pickInitialLanguage", () => {
  test("opens on the requested language by code or alias when it is enabled", () => {
    expect(pickInitialLanguage(["de-DE"], surveyLanguages, "en-US")).toBe("de-DE");
    expect(pickInitialLanguage(["german"], surveyLanguages, "en-US")).toBe("de-DE");
  });

  test("opens on the default language otherwise", () => {
    expect(pickInitialLanguage(undefined, surveyLanguages, "en-US")).toBe("en-US");
    expect(pickInitialLanguage(["fr-FR"], surveyLanguages, "en-US")).toBe("en-US");
  });
});

describe("toScriptUrl", () => {
  test("accepts http(s) and resolves relative addresses against the base", () => {
    expect(toScriptUrl("https://app.example.com/js/surveys.umd.cjs?v=1", "https://host.test/")).toBe(
      "https://app.example.com/js/surveys.umd.cjs?v=1"
    );
    expect(toScriptUrl("/js/surveys.umd.cjs", "http://localhost:4000/x")).toBe(
      "http://localhost:4000/js/surveys.umd.cjs"
    );
  });

  test("refuses every other scheme and unparseable input", () => {
    expect(toScriptUrl("javascript:alert(1)", "https://host.test/")).toBeNull();
    expect(toScriptUrl("data:text/javascript,alert(1)", "https://host.test/")).toBeNull();
    expect(toScriptUrl("//", "about:srcdoc")).toBeNull();
  });
});

describe("isHttpUrl", () => {
  test("only http(s) links may be handed to the host", () => {
    expect(isHttpUrl("https://formbricks.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("mailto:a@b.c")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});
