import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import type { TQsfAssembly, TQsfDraftElement } from "./assemble";
import { checkQsfDraft } from "./final-gate";
import { QSF_DRAFT_MAX_BYTES, fitQsfDraftToCreateLimit, measureQsfDraftBytes } from "./fit-draft";
import type { TQsfIssue, TQsfQuestion, TQsfSurvey } from "./qsf-model";

/** An assembly of `blocks` × `perBlock` open text questions, each headline `textChars` long in every language. */
const buildAssembly = (shape: {
  languages: string[];
  blocks: number;
  perBlock: number;
  textChars: number;
}): { assembly: TQsfAssembly; survey: TQsfSurvey } => {
  const [defaultLanguage] = shape.languages;
  const questions = new Map<string, TQsfQuestion>();
  const elementRefs: string[][] = [];
  const blocks = Array.from({ length: shape.blocks }, (_, b) => {
    const refs: string[] = [];
    const elements = Array.from({ length: shape.perBlock }, (_, e): TQsfDraftElement => {
      const n = b * shape.perBlock + e + 1;
      refs.push(`QID${n}`);
      questions.set(`QID${n}`, { ref: `QID${n}`, exportTag: `Q${n}` } as TQsfQuestion);
      return {
        id: `Q${n}`,
        type: "openText",
        headline: Object.fromEntries(
          shape.languages.map((code) => [code, `${code} ${"x".repeat(shape.textChars)}`])
        ),
        required: false,
        isDraft: true,
        inputType: "text",
        longAnswer: false,
        charLimit: { enabled: false },
      };
    });
    elementRefs.push(refs);
    return { id: `block${b}`, name: `Block ${b}`, elements };
  });
  const assembly: TQsfAssembly = {
    document: {
      workspaceId: "clxx1234567890123456789012",
      name: "Survey",
      type: "link",
      status: "draft",
      defaultLanguage,
      languages: shape.languages.map((code, index) => ({ code, default: index === 0, enabled: true })),
      blocks,
      endings: [
        {
          id: "end",
          type: "endScreen",
          headline: Object.fromEntries(shape.languages.map((c) => [c, "Bye"])),
        },
      ],
      hiddenFields: { enabled: false, fieldIds: [] },
    },
    issues: [],
    elementRefs,
  };
  return { assembly, survey: { questions } as TQsfSurvey };
};

const LANGUAGES = ["en-US", "de-DE", "fr-FR", "es-ES", "it-IT"];

describe("fitQsfDraftToCreateLimit", () => {
  test("is sized from the create's own body limit, with a margin", () => {
    expect(QSF_DRAFT_MAX_BYTES).toBeLessThan(DEFAULT_REQUEST_BODY_LIMIT_BYTES);
    expect(QSF_DRAFT_MAX_BYTES).toBeGreaterThan(DEFAULT_REQUEST_BODY_LIMIT_BYTES * 0.9);
  });

  test("leaves a draft that fits as it is", () => {
    const { assembly, survey } = buildAssembly({
      languages: LANGUAGES,
      blocks: 2,
      perBlock: 3,
      textChars: 20,
    });
    const before = structuredClone(assembly);

    const { dropped, keepIssue } = fitQsfDraftToCreateLimit(assembly, survey);

    expect(dropped).toEqual([]);
    expect(assembly).toEqual(before);
    expect(
      keepIssue({ code: "translation_fallback", severity: "warning", params: { language: "it-IT" } })
    ).toBe(true);
  });

  test("drops languages, last declared first, only as many as it takes", () => {
    const { assembly, survey } = buildAssembly({
      languages: LANGUAGES,
      blocks: 2,
      perBlock: 5,
      textChars: 1_000,
    });
    // Room for about three of the five languages.
    const maxBytes = Math.floor((measureQsfDraftBytes(assembly.document) * 3.2) / 5);

    const { dropped } = fitQsfDraftToCreateLimit(assembly, survey, maxBytes);

    expect(dropped).toEqual([
      { code: "language_skipped", severity: "warning", params: { code: "it-IT", cause: "draft_too_large" } },
      { code: "language_skipped", severity: "warning", params: { code: "es-ES", cause: "draft_too_large" } },
    ]);
    expect(assembly.document.languages.map((language) => language.code)).toEqual(["en-US", "de-DE", "fr-FR"]);
    const element = assembly.document.blocks[0].elements[0];
    expect(Object.keys(element.headline)).toEqual(["en-US", "de-DE", "fr-FR"]);
    expect(
      Object.keys(
        assembly.document.endings[0].type === "endScreen" ? assembly.document.endings[0].headline : {}
      )
    ).toEqual(["en-US", "de-DE", "fr-FR"]);
    expect(measureQsfDraftBytes(assembly.document)).toBeLessThanOrEqual(maxBytes);
    expect(assembly.document.blocks.flatMap((block) => block.elements)).toHaveLength(10);
  });

  test("drops trailing questions, and their emptied blocks, once only the default language is left", () => {
    const { assembly, survey } = buildAssembly({
      languages: ["en-US"],
      blocks: 3,
      perBlock: 4,
      textChars: 1_000,
    });
    // Room for about seven of the twelve questions: the third block and one question of the second go.
    const maxBytes = Math.floor((measureQsfDraftBytes(assembly.document) * 7.5) / 12);

    const { dropped } = fitQsfDraftToCreateLimit(assembly, survey, maxBytes);

    expect(dropped.map((issue) => issue.questionTag)).toEqual(["Q12", "Q11", "Q10", "Q9", "Q8"]);
    expect(dropped.every((issue) => issue.params?.cause === "draft_too_large")).toBe(true);
    expect(assembly.document.blocks.map((block) => block.elements.map((element) => element.id))).toEqual([
      ["Q1", "Q2", "Q3", "Q4"],
      ["Q5", "Q6", "Q7"],
    ]);
    expect(assembly.elementRefs).toEqual([
      ["QID1", "QID2", "QID3", "QID4"],
      ["QID5", "QID6", "QID7"],
    ]);
    expect(measureQsfDraftBytes(assembly.document)).toBeLessThanOrEqual(maxBytes);
  });

  test("keeps no question when even one does not fit, for the caller to fail the import", () => {
    const { assembly, survey } = buildAssembly({
      languages: ["en-US"],
      blocks: 1,
      perBlock: 2,
      textChars: 1_000,
    });

    fitQsfDraftToCreateLimit(assembly, survey, 500);

    expect(assembly.document.blocks).toEqual([]);
  });

  test("takes the report lines about what it cut with it", () => {
    const { assembly, survey } = buildAssembly({
      languages: LANGUAGES,
      blocks: 2,
      perBlock: 5,
      textChars: 1_000,
    });
    const maxBytes = Math.floor(measureQsfDraftBytes(assembly.document) / 6);

    const { keepIssue } = fitQsfDraftToCreateLimit(assembly, survey, maxBytes);
    const line = (issue: Partial<TQsfIssue>): TQsfIssue => ({
      code: "logic_not_imported",
      severity: "warning",
      ...issue,
    });

    expect(keepIssue(line({ code: "translation_fallback", params: { language: "de-DE", count: 2 } }))).toBe(
      false
    );
    expect(keepIssue(line({ questionTag: "Q10", questionRef: "QID10" }))).toBe(false);
    expect(keepIssue(line({ questionTag: "Q1", questionRef: "QID1" }))).toBe(true);
    // Matched by question id, not by export tag, which two questions can share.
    expect(keepIssue(line({ questionTag: "Q10", questionRef: "QID1" }))).toBe(true);
    expect(keepIssue(line({ code: "formatting_dropped" }))).toBe(true);
  });

  test("replaces every recall of a cut question with its fallback, and the create accepts the result", () => {
    const { assembly, survey } = buildAssembly({
      languages: ["en-US"],
      blocks: 3,
      perBlock: 4,
      textChars: 1_000,
    });
    const { document } = assembly;
    document.endings = [
      {
        id: createId(),
        type: "endScreen",
        headline: { "en-US": "Thanks for #recall:Q12/fallback:...#, and #recall:Q1/fallback:...#" },
      },
    ];
    // Not something the import writes — a recall points back — but a cut question's recall anywhere goes.
    const q2 = document.blocks[0].elements[1];
    q2.headline = { "en-US": "About #recall:Q11/fallback:...#" };
    const maxBytes = Math.floor((measureQsfDraftBytes(document) * 7.5) / 12);

    const { dropped } = fitQsfDraftToCreateLimit(assembly, survey, maxBytes);

    const ending = document.endings[0];
    expect(ending.type === "endScreen" ? ending.headline["en-US"] : "").toBe(
      "Thanks for ..., and #recall:Q1/fallback:...#"
    );
    expect(q2.headline["en-US"]).toBe("About ...");
    expect(dropped).toEqual(
      expect.arrayContaining([
        { code: "piped_text_removed", severity: "warning", params: { count: 1 } },
        {
          code: "piped_text_removed",
          severity: "warning",
          questionTag: "Q2",
          questionRef: "QID2",
          params: { count: 1 },
        },
      ])
    );
    expect(checkQsfDraft(document)).toEqual([]);
  });
});
