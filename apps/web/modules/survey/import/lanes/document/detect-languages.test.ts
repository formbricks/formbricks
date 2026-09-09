import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import {
  LANGUAGE_DETECTION_MIN_CHARS,
  type TLanguageDetection,
  allowedLanguageCodes,
  detectDocumentLanguages,
  languageAmbiguityIssue,
  normalizeDetectedLanguageCode,
  sanitizeDetectedLanguages,
} from "./detect-languages";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: vi.fn(),
  streamOrganizationAIObject: vi.fn(),
}));

const fixture = (name: string): TLanguageDetection =>
  JSON.parse(readFileSync(join(__dirname, "__fixtures__", "model-outputs", name), "utf8"));

const detection = (overrides: Partial<TLanguageDetection> = {}): TLanguageDetection => ({
  languages: [
    { code: "en", confidence: 0.95, evidence: ["How satisfied"] },
    { code: "German", confidence: 0.9, evidence: ["Wie zufrieden"] },
  ],
  primaryLanguageCode: "en",
  isAmbiguous: false,
  ambiguityReasons: [],
  ...overrides,
});

describe("normalizeDetectedLanguageCode", () => {
  test.each([
    ["en", "en-US"],
    ["German", "de-DE"],
    ["de_DE", "de-DE"],
    ["deu", "de-DE"],
    ["pt-BR", "pt-BR"],
    ["Português", "pt-BR"],
    ["FRENCH", "fr-FR"],
    ["", null],
    ["   ", null],
    ["klingon-ish", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDetectedLanguageCode(input)).toBe(expected);
  });
});

describe("sanitizeDetectedLanguages", () => {
  test("merges aliases of one language, keeps both confident languages and the model's primary", () => {
    const result = sanitizeDetectedLanguages(
      detection({
        languages: [
          { code: "en", confidence: 0.95, evidence: ["a"] },
          { code: "German", confidence: 0.8, evidence: ["b"] },
          { code: "de-DE", confidence: 0.9, evidence: ["c"] },
        ],
      })
    );

    expect(result.languages).toEqual([
      { code: "en-US", confidence: 0.95, evidence: ["a"] },
      { code: "de-DE", confidence: 0.9, evidence: ["b", "c"] },
    ]);
    expect(result.primaryLanguageCode).toBe("en-US");
    expect(result.isAmbiguous).toBe(false);
    expect(allowedLanguageCodes(result)).toEqual(["en-US", "de-DE"]);
    expect(languageAmbiguityIssue(result)).toBeNull();
  });

  test("two confident languages flagged ambiguous is the parallel-translation layout, not a warning", () => {
    const result = sanitizeDetectedLanguages(detection({ isAmbiguous: true, ambiguityReasons: ["mixed"] }));
    expect(result.isAmbiguous).toBe(false);
    expect(result.ambiguityReasons).toEqual([]);
  });

  test("the recorded ambiguous output keeps only the primary language and warns instead of throwing", () => {
    const result = sanitizeDetectedLanguages(fixture("ambiguous-languages.json"));

    expect(result.primaryLanguageCode).toBe("de-DE");
    expect(result.isAmbiguous).toBe(true);
    expect(result.ambiguityReasons).toEqual([
      "German and Dutch sentences alternate without being translations of each other.",
      "Top language confidence (0.55) is below 0.60.",
    ]);
    expect(allowedLanguageCodes(result)).toEqual(["de-DE"]);
    expect(languageAmbiguityIssue(result)).toMatchObject({
      severity: "warning",
      code: "language_ambiguous",
      vars: { code: "de-DE" },
    });
  });

  test("the workspace hint breaks a near tie and is recognised in any spelling", () => {
    const tied = detection({
      languages: [
        { code: "en", confidence: 0.9, evidence: [] },
        { code: "de", confidence: 0.85, evidence: [] },
      ],
      primaryLanguageCode: null,
    });
    expect(sanitizeDetectedLanguages(tied, "de_DE").primaryLanguageCode).toBe("de-DE");
    expect(sanitizeDetectedLanguages(tied).primaryLanguageCode).toBe("en-US");
    expect(sanitizeDetectedLanguages(tied, "fr").primaryLanguageCode).toBe("en-US");
  });

  test("nothing recognisable falls back to the hint (or en-US) as ambiguous", () => {
    const result = sanitizeDetectedLanguages(
      detection({ languages: [{ code: "???", confidence: 0.9, evidence: [] }], primaryLanguageCode: "???" }),
      "es"
    );
    expect(result.primaryLanguageCode).toBe("es-ES");
    expect(result.isAmbiguous).toBe(true);
    expect(allowedLanguageCodes(result)).toEqual(["es-ES"]);
    expect(
      sanitizeDetectedLanguages(detection({ languages: [{ code: "?", confidence: 1, evidence: [] }] }))
        .primaryLanguageCode
    ).toBe("en-US");
  });
});

describe("detectDocumentLanguages", () => {
  const base = { organizationId: "org_1", workspaceId: "ws_1", userId: "user_1" };

  beforeEach(() => {
    vi.mocked(generateOrganizationAIObject).mockReset();
  });

  test("skips the model for short texts", async () => {
    const result = await detectDocumentLanguages({
      ...base,
      text: "x".repeat(LANGUAGE_DETECTION_MIN_CHARS - 1),
    });
    expect(result).toBeNull();
    expect(generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("calls the model with the tiny schema and sanitizes its answer", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValue({ object: detection() } as never);

    const result = await detectDocumentLanguages({
      ...base,
      text: "Wie zufrieden sind Sie? ".repeat(400),
      languageHint: "de-DE",
    });

    expect(result?.languages.map((language) => language.code)).toEqual(["en-US", "de-DE"]);
    const call = vi.mocked(generateOrganizationAIObject).mock.calls[0][0];
    expect(call).toMatchObject({
      organizationId: "org_1",
      schemaName: "FormbricksSurveyImportLanguages",
      maxOutputTokens: 512,
      temperature: 0,
      aiTracing: { distinctId: "user_1", feature: "ai_survey_import", workspaceId: "ws_1" },
    });
    expect(call.prompt).toContain("default language is de-DE");
  });

  test("an unreadable detection result degrades to the hint with a reason", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValue({ object: { nope: true } } as never);

    const result = await detectDocumentLanguages({ ...base, text: "x".repeat(5000), languageHint: "fr-FR" });

    expect(result?.primaryLanguageCode).toBe("fr-FR");
    expect(result?.isAmbiguous).toBe(true);
    expect(result?.ambiguityReasons[0]).toBe("The detection result was unreadable.");
  });
});
