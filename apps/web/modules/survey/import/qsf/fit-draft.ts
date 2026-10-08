import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import type { TQsfImportIssue } from "../types";
import type { TQsfAssembly, TQsfDraftDocument } from "./assemble";
import type { TQsfSurvey } from "./qsf-model";

/**
 * Fit the draft to the create's body limit (ENG-3654). The dialog sends the draft to
 * `POST /api/v3/surveys` as `JSON.stringify(payload)` (`createV3Survey`), and that route reads at most
 * `DEFAULT_REQUEST_BODY_LIMIT_BYTES`: an import that ends `done` with a larger draft would only fail
 * when the user creates it. So, strip and warn (ENG-3411): languages go first, last declared first,
 * then trailing questions — later questions are the safe ones to cut, since recall only points back.
 */

/**
 * The most the draft may weigh: the create's limit less 64 KiB, so a draft the user renames or
 * otherwise touches in the dialog before creating it still fits.
 */
export const QSF_DRAFT_MAX_BYTES = DEFAULT_REQUEST_BODY_LIMIT_BYTES - 64 * 1024;

const encoder = new TextEncoder();
/** UTF-8 bytes, as the request body carries them. */
const byteLength = (text: string): number => encoder.encode(text).length;
const jsonBytes = (value: unknown): number => byteLength(JSON.stringify(value));

/** The bytes the create's request body takes for this draft. */
export const measureQsfDraftBytes = (document: TQsfDraftDocument): number => jsonBytes(document);

type TLocaleText = Record<string, string>;

/**
 * Every locale-keyed text in the draft: an object holding the default language's key, all of whose
 * keys are survey languages and all of whose values are strings. v3 requires every text to carry the
 * default language, and no other part of the draft is keyed by language codes.
 */
function collectLocaleTexts(document: TQsfDraftDocument): TLocaleText[] {
  const codes = new Set(document.languages.map((language) => language.code));
  const texts: TLocaleText[] = [];
  const stack: unknown[] = [document.blocks, document.endings];
  for (let value = stack.pop(); value !== undefined; value = stack.pop()) {
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const entries = Object.entries(value);
    const isLocaleText =
      Object.hasOwn(value, document.defaultLanguage) &&
      entries.every(([key, text]) => codes.has(key) && typeof text === "string");
    if (isLocaleText) texts.push(value as TLocaleText);
    else for (const [, child] of entries) stack.push(child);
  }
  return texts;
}

/**
 * Drop non-default languages, last declared first, until the draft fits. Each language's weight is
 * summed once — `,"code":"text"` in every text, and its entry in `languages` — so no step serializes
 * the draft again.
 */
function dropLanguages(document: TQsfDraftDocument, overBy: number, issues: TQsfImportIssue[]): number {
  const droppable = document.languages.filter((language) => !language.default);
  if (droppable.length === 0) return overBy;

  const texts = collectLocaleTexts(document);
  const weight = new Map<string, number>(
    document.languages.map((language) => [language.code, jsonBytes(language) + 1])
  );
  for (const text of texts) {
    for (const [code, value] of Object.entries(text)) {
      if (code === document.defaultLanguage) continue;
      weight.set(code, (weight.get(code) ?? 0) + byteLength(JSON.stringify(code)) + jsonBytes(value) + 2);
    }
  }

  const dropped = new Set<string>();
  let remaining = overBy;
  for (const language of droppable.reverse()) {
    if (remaining <= 0) break;
    dropped.add(language.code);
    remaining -= weight.get(language.code) ?? 0;
    issues.push({
      code: "language_skipped",
      severity: "warning",
      params: { code: language.code, cause: "draft_too_large" },
    });
  }

  document.languages = document.languages.filter((language) => !dropped.has(language.code));
  for (const text of texts) for (const code of dropped) delete text[code];
  return remaining;
}

/**
 * Drop trailing questions, and a block once it empties, until the draft fits. Each step weighs only
 * what it removes: the element and its comma, or the emptied block and its comma.
 */
function dropTrailingQuestions(
  assembly: TQsfAssembly,
  survey: TQsfSurvey,
  overBy: number,
  issues: TQsfImportIssue[]
): Set<string> {
  const { document, elementRefs } = assembly;
  /** The export tags of the questions cut. */
  const droppedTags = new Set<string>();
  let remaining = overBy;

  while (remaining > 0 && document.blocks.length > 0) {
    const blockIndex = document.blocks.length - 1;
    const block = document.blocks[blockIndex];
    const element = block.elements.pop();
    const ref = elementRefs[blockIndex]?.pop();
    if (element) {
      remaining -= jsonBytes(element) + (block.elements.length > 0 ? 1 : 0);
      const questionTag = (ref ? survey.questions.get(ref)?.exportTag : undefined) ?? element.id;
      droppedTags.add(questionTag);
      issues.push({
        code: "question_skipped",
        severity: "warning",
        questionTag,
        params: { cause: "draft_too_large" },
      });
    }
    if (block.elements.length === 0) {
      remaining -= jsonBytes(block) + (document.blocks.length > 1 ? 1 : 0);
      document.blocks.pop();
      elementRefs.pop();
    }
  }
  return droppedTags;
}

/**
 * Cut the assembly in place to fit `maxBytes`, and say what was cut. `keepIssue` filters the earlier
 * report lines: those about a cut language's fallbacks or a cut question go with them, so the report
 * describes the draft. An assembly that fits is left as it is. The caller fails the import if no
 * question is left.
 */
export function fitQsfDraftToCreateLimit(
  assembly: TQsfAssembly,
  survey: TQsfSurvey,
  maxBytes: number = QSF_DRAFT_MAX_BYTES
): { dropped: TQsfImportIssue[]; keepIssue: (issue: TQsfImportIssue) => boolean } {
  let overBy = measureQsfDraftBytes(assembly.document) - maxBytes;
  if (overBy <= 0) return { dropped: [], keepIssue: () => true };

  const dropped: TQsfImportIssue[] = [];
  const languagesBefore = assembly.document.languages.map((language) => language.code);
  const droppedTags = new Set<string>();

  // The weights are exact, but the result is measured again rather than trusted, and cut further if
  // it is still over.
  while (overBy > 0 && assembly.document.blocks.length > 0) {
    overBy = dropLanguages(assembly.document, overBy, dropped);
    if (overBy > 0) {
      dropTrailingQuestions(assembly, survey, overBy, dropped).forEach((tag) => droppedTags.add(tag));
    }
    overBy = measureQsfDraftBytes(assembly.document) - maxBytes;
  }

  const kept = new Set(assembly.document.languages.map((language) => language.code));
  const droppedLanguages = new Set(languagesBefore.filter((code) => !kept.has(code)));
  const keepIssue = (issue: TQsfImportIssue) =>
    !(issue.code === "translation_fallback" && droppedLanguages.has(String(issue.params?.language))) &&
    !(issue.questionTag !== undefined && droppedTags.has(issue.questionTag));
  return { dropped, keepIssue };
}
