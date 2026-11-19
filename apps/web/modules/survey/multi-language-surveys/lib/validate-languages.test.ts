import { describe, expect, test } from "vitest";
import { getLanguagesValidationError } from "./validate-languages";

const rows = (...codes: string[]) => codes.map((code) => ({ code, alias: null }));

describe("getLanguagesValidationError", () => {
  test("accepts distinct languages", () => {
    expect(getLanguagesValidationError(rows("de-DE", "fr-FR"))).toBeNull();
  });

  test("asks for a language when a row has none", () => {
    expect(getLanguagesValidationError(rows("de-DE", ""))).toBe(
      "workspace.languages.please_select_a_language"
    );
  });

  test("refuses the same code twice", () => {
    expect(getLanguagesValidationError(rows("de-DE", "de-de"))).toBe(
      "workspace.languages.duplicate_language_or_language_id"
    );
  });

  test("refuses the same alias twice", () => {
    expect(
      getLanguagesValidationError([
        { code: "de-DE", alias: "german" },
        { code: "fr-FR", alias: "German" },
      ])
    ).toBe("workspace.languages.duplicate_language_or_language_id");
  });

  test("refuses an alias equal to another row's code", () => {
    expect(
      getLanguagesValidationError([
        { code: "de-de", alias: null },
        { code: "fr-FR", alias: "de-DE" },
      ])
    ).toBe("workspace.languages.conflict_between_identifier_and_alias");
  });

  test("refuses an alias that is the ISO code of a language not in the list", () => {
    expect(getLanguagesValidationError([{ code: "fr-FR", alias: "nl" }])).toBe(
      "workspace.languages.conflict_between_selected_alias_and_another_language"
    );
  });
});
