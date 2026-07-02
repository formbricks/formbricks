import { describe, expect, test } from "vitest";
import type { LanguageRow, SurveyLanguageRow } from "./types";
import { planLanguageMerges, planSurveyLanguageMoves, rewriteI18nKeys, toCanonical } from "./utils";

// Characterization tests for the migration's pure planning/rewrite logic — the trickiest,
// most data-mangling-prone code in the language-canonicalization migration (collision survivorship,
// SurveyLanguage composite-PK dedup + flag promotion, order-preserving i18n-key rewrites). Every
// expectation was captured from the actual current implementation.

const lang = (
  id: string,
  code: string,
  createdAt: string,
  alias: string | null = null,
  workspaceId = "w1"
): LanguageRow => ({ id, code, alias, workspaceId, createdAt: new Date(createdAt) });

const link = (languageId: string, surveyId: string, def = false, enabled = true): SurveyLanguageRow => ({
  languageId,
  surveyId,
  default: def,
  enabled,
});

describe("toCanonical", () => {
  test("maps legacy codes to their canonical BCP-47 form", () => {
    expect(toCanonical("de")).toBe("de-DE");
    expect(toCanonical("pt")).toBe("pt-BR");
    expect(toCanonical("zh")).toBe("zh-Hans-CN");
    expect(toCanonical("tl")).toBe("fil-PH");
    expect(toCanonical("en")).toBe("en-US");
    expect(toCanonical("hi")).toBe("hi-IN");
  });

  test("leaves already-canonical codes unchanged", () => {
    expect(toCanonical("de-DE")).toBe("de-DE");
    expect(toCanonical("pt-BR")).toBe("pt-BR");
    expect(toCanonical("zh-Hans-CN")).toBe("zh-Hans-CN");
  });

  test("returns unknown/junk codes unchanged (never drops)", () => {
    expect(toCanonical("xx")).toBe("xx");
    expect(toCanonical("123")).toBe("123");
  });
});

describe("rewriteI18nKeys", () => {
  test("rewrites a legacy language key to canonical, preserving the default sentinel", () => {
    const result = rewriteI18nKeys({ default: "D", de: "x" });
    expect(result.changed).toBe(true);
    expect(result.keysRewritten).toBe(1);
    expect(result.value).toEqual({ default: "D", "de-DE": "x" });
    // default is preserved verbatim and stays first
    expect(Object.keys(result.value as Record<string, string>)[0]).toBe("default");
  });

  describe("collision merge (de + de-DE -> de-DE) via pickI18nValue", () => {
    test("a non-empty value beats an empty one, either order", () => {
      expect(rewriteI18nKeys({ default: "D", de: "keepme", "de-DE": "" }).value).toEqual({
        default: "D",
        "de-DE": "keepme",
      });
      expect(rewriteI18nKeys({ default: "D", de: "", "de-DE": "keepme" }).value).toEqual({
        default: "D",
        "de-DE": "keepme",
      });
    });

    test("when both are non-empty, the value from the already-canonical key wins (order-independent)", () => {
      expect(rewriteI18nKeys({ default: "D", de: "fromBare", "de-DE": "fromCanon" }).value).toEqual({
        default: "D",
        "de-DE": "fromCanon",
      });
      expect(rewriteI18nKeys({ default: "D", "de-DE": "fromCanon", de: "fromBare" }).value).toEqual({
        default: "D",
        "de-DE": "fromCanon",
      });
    });
  });

  test("preserves array element order (blocks/endings)", () => {
    const result = rewriteI18nKeys([
      { id: "a", headline: { default: "A", de: "a-de" } },
      { id: "b", headline: { default: "B", de: "b-de" } },
      { id: "c", headline: { default: "C", pt: "c-pt" } },
    ]);
    expect(result.changed).toBe(true);
    expect(result.keysRewritten).toBe(3);
    expect(result.value).toEqual([
      { id: "a", headline: { default: "A", "de-DE": "a-de" } },
      { id: "b", headline: { default: "B", "de-DE": "b-de" } },
      { id: "c", headline: { default: "C", "pt-BR": "c-pt" } },
    ]);
  });

  test("recurses into nested objects (welcomeCard-style) without touching non-i18n fields", () => {
    expect(rewriteI18nKeys({ enabled: true, headline: { default: "H", de: "h-de" } }).value).toEqual({
      enabled: true,
      headline: { default: "H", "de-DE": "h-de" },
    });
  });

  test("returns the SAME reference (no copy) when nothing changed", () => {
    const config = { enabled: true, count: 3 };
    const configResult = rewriteI18nKeys(config);
    expect(configResult.changed).toBe(false);
    expect(configResult.value).toBe(config);

    const defaultOnly = { default: "only" };
    const defaultOnlyResult = rewriteI18nKeys(defaultOnly);
    expect(defaultOnlyResult.changed).toBe(false);
    expect(defaultOnlyResult.value).toBe(defaultOnly);

    const canonical = { default: "D", "de-DE": "x", "pt-BR": "y" };
    const canonicalResult = rewriteI18nKeys(canonical);
    expect(canonicalResult.changed).toBe(false);
    expect(canonicalResult.value).toBe(canonical);
  });

  test("collects unresolvable content keys in `unresolved` and leaves them as-is", () => {
    const result = rewriteI18nKeys({ default: "D", de: "x", zz: "junk", "12": "n" });
    expect(result.unresolved.sort()).toEqual(["12", "zz"]);
    expect(result.keysRewritten).toBe(1); // only `de` -> `de-DE`
    expect(result.value).toEqual({ default: "D", "de-DE": "x", zz: "junk", "12": "n" });
  });
});

describe("planLanguageMerges", () => {
  test("relabels a lone non-canonical row (no collision)", () => {
    expect(planLanguageMerges([lang("l1", "de", "2024-01-01")])).toEqual({
      relabels: [{ id: "l1", toCode: "de-DE" }],
      merges: [],
    });
  });

  test("does nothing for a lone already-canonical row", () => {
    expect(planLanguageMerges([lang("l1", "de-DE", "2024-01-01")])).toEqual({
      relabels: [],
      merges: [],
    });
  });

  test("on collision, a row already at the canonical code survives without a relabel", () => {
    const plan = planLanguageMerges([lang("l1", "de", "2024-01-01"), lang("l2", "de-DE", "2024-02-01")]);
    expect(plan.relabels).toEqual([]);
    expect(plan.merges).toEqual([
      {
        workspaceId: "w1",
        canonical: "de-DE",
        survivorId: "l2",
        survivorNeedsRelabel: false,
        aliasToSet: null,
        absorbedIds: ["l1"],
      },
    ]);
  });

  test("on collision with no canonical row, the OLDEST (createdAt, then id) survives and needs relabel", () => {
    const plan = planLanguageMerges([lang("l2", "de", "2024-03-01"), lang("l1", "de", "2024-01-01")]);
    expect(plan.merges).toEqual([
      {
        workspaceId: "w1",
        canonical: "de-DE",
        survivorId: "l1", // older, despite being listed second
        survivorNeedsRelabel: true,
        aliasToSet: null,
        absorbedIds: ["l2"],
      },
    ]);
  });

  test("copies an absorbed row's alias onto the survivor only when the survivor has none", () => {
    // survivor has no alias -> takes the absorbed alias
    expect(
      planLanguageMerges([
        lang("l1", "de", "2024-01-01", null),
        lang("l2", "de", "2024-02-01", "FromAbsorbed"),
      ]).merges[0].aliasToSet
    ).toBe("FromAbsorbed");

    // survivor already has an alias -> absorbed alias is ignored
    expect(
      planLanguageMerges([
        lang("l1", "de-DE", "2024-02-01", "Mine"),
        lang("l2", "de", "2024-01-01", "Absorbed"),
      ]).merges[0].aliasToSet
    ).toBeNull();
  });

  test("groups per workspace: the same code in two workspaces is two independent relabels, not a merge", () => {
    expect(
      planLanguageMerges([
        lang("l1", "de", "2024-01-01", null, "w1"),
        lang("l2", "de", "2024-01-01", null, "w2"),
      ])
    ).toEqual({
      relabels: [
        { id: "l1", toCode: "de-DE" },
        { id: "l2", toCode: "de-DE" },
      ],
      merges: [],
    });
  });
});

describe("planSurveyLanguageMoves", () => {
  test("repoints an absorbed link when the survivor doesn't link that survey yet", () => {
    expect(planSurveyLanguageMoves("surv", ["abs1"], [link("abs1", "s1")])).toEqual({
      repoints: [{ surveyId: "s1", fromLanguageId: "abs1" }],
      deletes: [],
      flagUpdates: [],
    });
  });

  test("deletes the absorbed link when the survivor already links the survey (composite-PK dedup) and promotes flags", () => {
    expect(
      planSurveyLanguageMoves(
        "surv",
        ["abs1"],
        [
          link("surv", "s1", false, true),
          link("abs1", "s1", true, true), // absorbed carried default=true -> promoted onto survivor
        ]
      )
    ).toEqual({
      repoints: [],
      deletes: [{ surveyId: "s1", languageId: "abs1" }],
      flagUpdates: [{ surveyId: "s1", default: true, enabled: true }],
    });
  });

  test("emits no flag update when the survivor's link already carries the flags", () => {
    expect(
      planSurveyLanguageMoves(
        "surv",
        ["abs1"],
        [link("surv", "s1", true, true), link("abs1", "s1", false, true)]
      )
    ).toEqual({
      repoints: [],
      deletes: [{ surveyId: "s1", languageId: "abs1" }],
      flagUpdates: [],
    });
  });

  test("dedupes a second absorbed link against the repointed baseline (repoint-then-delete on the same survey)", () => {
    // abs1 repoints (survivor not yet linked); abs2 must then dedupe against that repointed link,
    // and its default=true is promoted onto the survivor's (now-repointed) link for the survey.
    expect(
      planSurveyLanguageMoves(
        "surv",
        ["abs1", "abs2"],
        [link("abs1", "s1", false, true), link("abs2", "s1", true, true)]
      )
    ).toEqual({
      repoints: [{ surveyId: "s1", fromLanguageId: "abs1" }],
      deletes: [{ surveyId: "s1", languageId: "abs2" }],
      flagUpdates: [{ surveyId: "s1", default: true, enabled: true }],
    });
  });
});
