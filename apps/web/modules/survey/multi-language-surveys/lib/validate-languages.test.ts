import { describe, expect, test } from "vitest";
import { getLanguagesValidationError } from "./validate-languages";

const rows = (...codes: string[]) => codes.map((code) => ({ code, alias: null }));

describe("getLanguagesValidationError", () => {
  test("accepts distinct languages", () => {
    expect(getLanguagesValidationError(rows("de-DE", "fr-FR"))).toBeNull();
  });

  test("asks for a language when a row has none", () => {
    expect(getLanguagesValidationError(rows("de-DE", ""))).toBe("missing_language");
  });

  test("refuses the same code twice", () => {
    expect(getLanguagesValidationError(rows("de-DE", "de-de"))).toBe("duplicate_language_or_alias");
  });

  // The server stores the canonical tag, so two codes that canonicalize alike collide on save (ENG-3602).
  test.each([
    ["de", "de-DE"],
    ["pt", "pt-BR"],
    ["en_us", "en-US"],
    ["  DE  ", "de-DE"],
  ])("refuses %j next to %j, which the server stores as the same language", (added, existing) => {
    expect(getLanguagesValidationError(rows(existing, added))).toBe("duplicate_language_or_alias");
  });

  test("refuses the same alias twice", () => {
    expect(
      getLanguagesValidationError([
        { code: "de-DE", alias: "german" },
        { code: "fr-FR", alias: "German" },
      ])
    ).toBe("duplicate_language_or_alias");
  });

  test("refuses an alias equal to another row's code", () => {
    expect(
      getLanguagesValidationError([
        { code: "de-de", alias: null },
        { code: "fr-FR", alias: "de-DE" },
      ])
    ).toBe("alias_matches_a_code");
  });

  test("refuses an alias that is the ISO code of a language not in the list", () => {
    expect(getLanguagesValidationError([{ code: "fr-FR", alias: "nl" }])).toBe(
      "alias_matches_another_language"
    );
  });
});
