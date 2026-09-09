import "server-only";
import { z } from "zod";
import { iso639Languages, normalizeLanguageCode } from "@formbricks/i18n-utils";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { importWarning } from "../../report";
import type { TImportDetectedLanguage, TImportIssue } from "../../types";
import { abortAfter } from "./abort";
import { buildLanguageDetectionSystemPrompt, buildLanguageDetectionUserPrompt } from "./prompt";

/** Below this the detection call is skipped; the extraction call's own language codes decide (ENG-2999). */
export const LANGUAGE_DETECTION_MIN_CHARS = 4_000;
export const LANGUAGE_CONFIDENCE_THRESHOLD = 0.6;
const LANGUAGE_DETECTION_MAX_OUTPUT_TOKENS = 512;
const LANGUAGE_DETECTION_TIMEOUT_MS = 20_000;

export const ZLanguageDetection = z
  .object({
    languages: z
      .array(
        z
          .object({
            code: z.string().trim().min(1).max(40),
            confidence: z.number().min(0).max(1),
            evidence: z.array(z.string().trim().min(1).max(200)).max(5),
          })
          .strict()
      )
      .min(1)
      .max(8),
    primaryLanguageCode: z.string().trim().min(1).max(40).nullable(),
    isAmbiguous: z.boolean(),
    ambiguityReasons: z.array(z.string().trim().min(1).max(300)).max(5),
  })
  .strict();

export type TLanguageDetection = z.infer<typeof ZLanguageDetection>;

export type TDetectedLanguage = TImportDetectedLanguage & { evidence: string[] };

export type TSanitizedLanguages = {
  languages: TDetectedLanguage[];
  primaryLanguageCode: string;
  isAmbiguous: boolean;
  ambiguityReasons: string[];
};

/** Names the model may return instead of a code (ported from PR #7729). Lower-case keys. */
const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  german: "de",
  deutsch: "de",
  french: "fr",
  français: "fr",
  francais: "fr",
  spanish: "es",
  español: "es",
  espanol: "es",
  portuguese: "pt",
  português: "pt",
  italian: "it",
  italiano: "it",
  dutch: "nl",
  nederlands: "nl",
  japanese: "ja",
  chinese: "zh",
  swedish: "sv",
  russian: "ru",
  arabic: "ar",
  polish: "pl",
  turkish: "tr",
  korean: "ko",
  hindi: "hi",
};

/**
 * Model output ("German", "de", "de_DE", "deu") → canonical region-tagged BCP-47 (`de-DE`), or null when
 * nothing recognizable is left. Aliases and the ISO 639 list resolve names first; `normalizeLanguageCode`
 * (i18n-utils) then adds the canonical region so v3's region-qualified requirement holds.
 */
export function normalizeDetectedLanguageCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower.length === 0) return null;

  const aliased = LANGUAGE_ALIASES[lower] ?? lower;
  const canonicalDirect = normalizeLanguageCode(aliased);
  if (canonicalDirect) return canonicalDirect;

  const base = aliased.split(/[-_]/)[0];
  const isoMatch = iso639Languages.find(
    (language) => language.code.toLowerCase() === base || language.label["en-US"].toLowerCase() === aliased
  );
  return normalizeLanguageCode(isoMatch?.code ?? base);
}

/**
 * Merges duplicate codes, drops unknown ones and decides the primary language. Never throws (unlike
 * PR #7729): with nothing usable it falls back to the hint or `en-US` and says so in the reasons; an
 * ambiguous detection keeps the primary language and reports `language_ambiguous` downstream.
 */
export function sanitizeDetectedLanguages(
  detection: TLanguageDetection,
  languageHint?: string
): TSanitizedLanguages {
  const merged = new Map<string, TDetectedLanguage>();
  for (const entry of detection.languages) {
    const code = normalizeDetectedLanguageCode(entry.code);
    if (!code) continue;
    const existing = merged.get(code);
    merged.set(code, {
      code,
      confidence: Math.max(existing?.confidence ?? 0, entry.confidence),
      evidence: [...new Set([...(existing?.evidence ?? []), ...entry.evidence])],
    });
  }

  const languages = [...merged.values()].sort((a, b) => b.confidence - a.confidence);
  const ambiguityReasons = [...detection.ambiguityReasons];
  const hint = normalizeDetectedLanguageCode(languageHint);

  if (languages.length === 0) {
    const fallback = hint ?? "en-US";
    ambiguityReasons.push(`No recognizable language was detected; assuming ${fallback}.`);
    return {
      languages: [{ code: fallback, confidence: 0, evidence: [] }],
      primaryLanguageCode: fallback,
      isAmbiguous: true,
      ambiguityReasons,
    };
  }

  const top = languages[0];
  if (top.confidence < LANGUAGE_CONFIDENCE_THRESHOLD) {
    ambiguityReasons.push(
      `Top language confidence (${top.confidence.toFixed(2)}) is below ${LANGUAGE_CONFIDENCE_THRESHOLD.toFixed(2)}.`
    );
  }

  // A hint breaks ties: when the hinted language is present and within reach of the top one, it leads.
  const hinted = hint ? languages.find((language) => language.code === hint) : undefined;
  const modelPrimary = normalizeDetectedLanguageCode(detection.primaryLanguageCode);
  let primaryLanguageCode = modelPrimary && merged.has(modelPrimary) ? modelPrimary : top.code;
  if (hinted && hinted.confidence >= top.confidence - 0.1 && primaryLanguageCode !== hint) {
    primaryLanguageCode = hinted.code;
  }

  // Two confident languages with the model flagging ambiguity is the parallel-translation layout, not a problem.
  const confident = languages.filter(
    (language) => language.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
  ).length;
  const parallelTranslation = detection.isAmbiguous && confident >= 2;
  if (detection.isAmbiguous && !parallelTranslation && ambiguityReasons.length === 0) {
    ambiguityReasons.push("The model flagged the language detection as ambiguous.");
  }

  const isAmbiguous =
    (detection.isAmbiguous && !parallelTranslation) || top.confidence < LANGUAGE_CONFIDENCE_THRESHOLD;
  return {
    languages,
    primaryLanguageCode,
    isAmbiguous,
    ambiguityReasons: isAmbiguous ? ambiguityReasons : [],
  };
}

/** The codes the extraction schema may use: on ambiguity only the primary one survives (D2). */
export function allowedLanguageCodes(sanitized: TSanitizedLanguages): string[] {
  if (sanitized.isAmbiguous) {
    return [sanitized.primaryLanguageCode];
  }
  const codes = sanitized.languages
    .filter((language) => language.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD)
    .map((language) => language.code);
  return codes.includes(sanitized.primaryLanguageCode) ? codes : [sanitized.primaryLanguageCode, ...codes];
}

export function languageAmbiguityIssue(sanitized: TSanitizedLanguages): TImportIssue | null {
  if (!sanitized.isAmbiguous) return null;
  return importWarning({
    code: "language_ambiguous",
    vars: { code: sanitized.primaryLanguageCode, reasons: sanitized.ambiguityReasons.join(" ") },
  });
}

export type TDetectDocumentLanguagesParams = {
  text: string;
  organizationId: string;
  workspaceId: string;
  userId?: string | null;
  languageHint?: string;
  /** Trace id shared by every model call of one import run. */
  importRunId?: string;
  signal?: AbortSignal;
};

/**
 * Cheap first call for long documents. Returns null for short texts (the extraction call decides) so the
 * caller can build the schema enum from the hint instead.
 */
export async function detectDocumentLanguages(
  params: TDetectDocumentLanguagesParams
): Promise<TSanitizedLanguages | null> {
  if (params.text.length < LANGUAGE_DETECTION_MIN_CHARS) {
    return null;
  }

  const generation = await generateOrganizationAIObject({
    organizationId: params.organizationId,
    aiTracing: params.userId
      ? {
          distinctId: params.userId,
          feature: AI_TRACING_FEATURE.SurveyImport,
          workspaceId: params.workspaceId,
          traceId: params.importRunId,
          properties: {
            step: "detect_languages",
            ...(params.importRunId ? { importRunId: params.importRunId } : {}),
          },
        }
      : undefined,
    schema: ZLanguageDetection,
    schemaName: "FormbricksSurveyImportLanguages",
    schemaDescription: "The languages used in a questionnaire's text.",
    system: buildLanguageDetectionSystemPrompt(),
    prompt: buildLanguageDetectionUserPrompt(params.text, params.languageHint),
    temperature: 0,
    maxOutputTokens: LANGUAGE_DETECTION_MAX_OUTPUT_TOKENS,
    timeout: LANGUAGE_DETECTION_TIMEOUT_MS,
    abortSignal: abortAfter(LANGUAGE_DETECTION_TIMEOUT_MS, params.signal),
  });

  const parsed = ZLanguageDetection.safeParse(generation.object);
  if (!parsed.success) {
    return sanitizeDetectedLanguages(
      {
        languages: [],
        primaryLanguageCode: null,
        isAmbiguous: true,
        ambiguityReasons: ["The detection result was unreadable."],
      },
      params.languageHint
    );
  }
  return sanitizeDetectedLanguages(parsed.data, params.languageHint);
}
