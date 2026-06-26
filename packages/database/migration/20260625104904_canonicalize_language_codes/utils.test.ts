import { describe, expect, test } from "vitest";
import type { LanguageRow, SurveyLanguageRow } from "./types";
import { planLanguageMerges, planSurveyLanguageMoves, rewriteI18nKeys, toCanonical } from "./utils";

const lang = (overrides: Partial<LanguageRow> & Pick<LanguageRow, "id" | "code">): LanguageRow => ({
  alias: null,
  workspaceId: "ws1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

describe("toCanonical", () => {
  test("canonicalizes bare codes to region-tagged BCP-47", () => {
    expect(toCanonical("de")).toBe("de-DE");
    expect(toCanonical("pt")).toBe("pt-BR");
    expect(toCanonical("en")).toBe("en-US");
  });

  test("leaves already-canonical codes unchanged", () => {
    expect(toCanonical("de-DE")).toBe("de-DE");
    expect(toCanonical("de-AT")).toBe("de-AT");
  });

  test("is case-insensitive", () => {
    expect(toCanonical("PT-BR")).toBe("pt-BR");
  });

  test("leaves unresolvable codes untouched (never drops)", () => {
    expect(toCanonical("123")).toBe("123");
  });
});

describe("rewriteI18nKeys", () => {
  test("leaves a single-language (default-only) string unchanged", () => {
    const input = { default: "Hello" };
    const result = rewriteI18nKeys(input);
    expect(result.changed).toBe(false);
    expect(result.value).toBe(input);
  });

  test("rewrites a legacy language key to canonical and preserves default", () => {
    const result = rewriteI18nKeys({ default: "Hello", de: "Hallo" });
    expect(result.changed).toBe(true);
    expect(result.keysRewritten).toBe(1);
    expect(result.value).toEqual({ default: "Hello", "de-DE": "Hallo" });
  });

  test("merges keys that collapse to the same canonical, preferring the canonical key's value", () => {
    const result = rewriteI18nKeys({ default: "Hi", de: "from legacy", "de-DE": "from canonical" });
    expect(result.changed).toBe(true);
    expect(result.value).toEqual({ default: "Hi", "de-DE": "from canonical" });
  });

  test("on collision, a non-empty value beats an empty canonical value", () => {
    const result = rewriteI18nKeys({ default: "Hi", de: "kept", "de-DE": "" });
    expect(result.value).toEqual({ default: "Hi", "de-DE": "kept" });
  });

  test("recurses into nested arrays and objects (block-like content)", () => {
    const input = {
      blocks: [{ headline: { default: "Q", de: "Frage" }, type: "openText" }],
    };
    const result = rewriteI18nKeys(input);
    expect(result.changed).toBe(true);
    expect(result.value).toEqual({
      blocks: [{ headline: { default: "Q", "de-DE": "Frage" }, type: "openText" }],
    });
  });

  test("does not treat config objects with non-string values as i18nStrings", () => {
    const input = { enabled: true, default: "x" };
    const result = rewriteI18nKeys(input);
    // `enabled` is not a string, so this is a plain object, not an i18nString — no key rewrite.
    expect(result.changed).toBe(false);
  });

  test("reports unresolvable content keys without rewriting them", () => {
    const result = rewriteI18nKeys({ default: "Hi", "123": "junk" });
    expect(result.unresolved).toContain("123");
    expect((result.value as Record<string, string>)["123"]).toBe("junk");
  });
});

describe("planLanguageMerges", () => {
  test("relabels a lone non-canonical row", () => {
    const plan = planLanguageMerges([lang({ id: "l1", code: "de" })]);
    expect(plan.relabels).toEqual([{ id: "l1", toCode: "de-DE" }]);
    expect(plan.merges).toHaveLength(0);
  });

  test("skips a lone already-canonical row", () => {
    const plan = planLanguageMerges([lang({ id: "l1", code: "de-DE" })]);
    expect(plan.relabels).toHaveLength(0);
    expect(plan.merges).toHaveLength(0);
  });

  test("keeps codes scoped per workspace", () => {
    const plan = planLanguageMerges([
      lang({ id: "a", code: "de", workspaceId: "ws1" }),
      lang({ id: "b", code: "de", workspaceId: "ws2" }),
    ]);
    expect(plan.relabels).toHaveLength(2);
    expect(plan.merges).toHaveLength(0);
  });

  test("on collision, prefers the row already at the canonical code as survivor", () => {
    const plan = planLanguageMerges([
      lang({ id: "legacy", code: "de" }),
      lang({ id: "canon", code: "de-DE", alias: "Deutsch" }),
    ]);
    expect(plan.relabels).toHaveLength(0);
    expect(plan.merges).toEqual([
      {
        workspaceId: "ws1",
        canonical: "de-DE",
        survivorId: "canon",
        survivorNeedsRelabel: false,
        aliasToSet: null,
        absorbedIds: ["legacy"],
      },
    ]);
  });

  test("when no row is canonical, picks the oldest as survivor and copies an absorbed alias", () => {
    const canonical = toCanonical("zh-TW"); // zh-Hant-TW
    const plan = planLanguageMerges([
      lang({ id: "newer", code: "zh-Hant", createdAt: new Date("2024-06-01T00:00:00Z") }),
      lang({ id: "older", code: "zh-TW", createdAt: new Date("2024-01-01T00:00:00Z"), alias: null }),
    ]);
    expect(plan.merges).toEqual([
      {
        workspaceId: "ws1",
        canonical,
        survivorId: "older",
        survivorNeedsRelabel: true,
        aliasToSet: null,
        absorbedIds: ["newer"],
      },
    ]);
  });

  test("copies an absorbed row's alias onto an alias-less survivor", () => {
    const plan = planLanguageMerges([
      lang({ id: "canon", code: "de-DE", alias: null }),
      lang({ id: "legacy", code: "de", alias: "Deutsch" }),
    ]);
    expect(plan.merges[0].aliasToSet).toBe("Deutsch");
  });
});

describe("planSurveyLanguageMoves", () => {
  const link = (
    overrides: Partial<SurveyLanguageRow> & Pick<SurveyLanguageRow, "languageId" | "surveyId">
  ): SurveyLanguageRow => ({
    default: false,
    enabled: true,
    ...overrides,
  });

  test("repoints an absorbed link when the survivor doesn't link that survey", () => {
    const moves = planSurveyLanguageMoves("S", ["A"], [link({ languageId: "A", surveyId: "sv1" })]);
    expect(moves.repoints).toEqual([{ surveyId: "sv1", fromLanguageId: "A" }]);
    expect(moves.deletes).toHaveLength(0);
  });

  test("dedupes and bumps default flag when survivor already links that survey", () => {
    const moves = planSurveyLanguageMoves(
      "S",
      ["A"],
      [
        link({ languageId: "S", surveyId: "sv1", default: false, enabled: false }),
        link({ languageId: "A", surveyId: "sv1", default: true, enabled: true }),
      ]
    );
    expect(moves.repoints).toHaveLength(0);
    expect(moves.deletes).toEqual([{ surveyId: "sv1", languageId: "A" }]);
    expect(moves.flagUpdates).toEqual([{ surveyId: "sv1", default: true, enabled: true }]);
  });

  test("does not emit a flag update when the survivor link already covers the flags", () => {
    const moves = planSurveyLanguageMoves(
      "S",
      ["A"],
      [
        link({ languageId: "S", surveyId: "sv1", default: true, enabled: true }),
        link({ languageId: "A", surveyId: "sv1", default: true, enabled: true }),
      ]
    );
    expect(moves.deletes).toHaveLength(1);
    expect(moves.flagUpdates).toHaveLength(0);
  });

  test("two absorbed links to the same survey: first repoints, second dedupes", () => {
    const moves = planSurveyLanguageMoves(
      "S",
      ["A1", "A2"],
      [link({ languageId: "A1", surveyId: "sv1" }), link({ languageId: "A2", surveyId: "sv1" })]
    );
    expect(moves.repoints).toHaveLength(1);
    expect(moves.deletes).toHaveLength(1);
  });
});
