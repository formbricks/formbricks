import { describe, expect, test } from "vitest";
import { hasTranslation, resolveText, toPlainText } from "./i18n-text";

describe("resolveText", () => {
  const value = { "en-US": "Hello", "de-DE": "Hallo" };

  test("returns the requested language", () => {
    expect(resolveText(value, "de-DE", "en-US")).toBe("Hallo");
  });

  test("matches language codes case-insensitively", () => {
    expect(resolveText(value, "de-de", "en-US")).toBe("Hallo");
  });

  test("falls back to the default language, then to any text", () => {
    expect(resolveText(value, "fr-FR", "en-US")).toBe("Hello");
    expect(resolveText({ "es-ES": "Hola" }, "fr-FR", "en-US")).toBe("Hola");
  });

  test("reads the renderer's `default` key", () => {
    expect(resolveText({ default: "Hi" }, "en-US", "en-US")).toBe("Hi");
  });

  test("returns an empty string for anything that is not text", () => {
    expect(resolveText(undefined, "en-US", "en-US")).toBe("");
    expect(resolveText({ a: 1 }, "en-US", "en-US")).toBe("");
  });
});

describe("toPlainText", () => {
  test("strips markup and decodes entities so content is only ever shown as text", () => {
    expect(toPlainText('<p>Tom &amp; <b>Jerry</b></p><script>alert("x")</script>')).toBe(
      'Tom & Jerry alert("x")'
    );
  });

  test("keeps words apart across block elements and line breaks", () => {
    expect(toPlainText("<p>One</p><p>Two<br>Three</p>")).toBe("One Two Three");
  });
});

describe("hasTranslation", () => {
  test("is false for a missing or empty translation", () => {
    expect(hasTranslation({ "en-US": "a", "de-DE": "" }, "de-DE")).toBe(false);
    expect(hasTranslation({ "en-US": "a" }, "de-DE")).toBe(false);
    expect(hasTranslation({ "en-US": "a", "de-DE": "b" }, "de-DE")).toBe(true);
  });
});
