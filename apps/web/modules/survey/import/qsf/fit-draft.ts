import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import { type TQsfAssembly, type TQsfDraftDocument, withLanguageSettings } from "./assemble";
import type { TQsfIssue, TQsfPage, TQsfQuestion, TQsfSurvey, TQsfTextKey } from "./qsf-model";
import { isUnsupportedType } from "./unsupported-types";

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
function collectLocaleTexts(
  document: TQsfDraftDocument,
  roots: unknown[] = [document.blocks, document.endings]
): TLocaleText[] {
  const codes = new Set(document.languages.map((language) => language.code));
  const texts: TLocaleText[] = [];
  const stack: unknown[] = [...roots];
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
function dropLanguages(document: TQsfDraftDocument, overBy: number, issues: TQsfIssue[]): number {
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
      params: { code: language.code, cause: "draft_too_large", order: "last_declared_first" },
    });
  }

  document.languages = document.languages.filter((language) => !dropped.has(language.code));
  for (const text of texts) for (const code of dropped) delete text[code];
  withLanguageSettings(document);
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
  issues: TQsfIssue[]
): { refs: Set<string>; elementIds: Set<string> } {
  const { document, elementRefs } = assembly;
  /** The questions cut, by Qualtrics id: export tags can repeat. */
  const droppedRefs = new Set<string>();
  const elementIds = new Set<string>();
  let remaining = overBy;

  while (remaining > 0 && document.blocks.length > 0) {
    const blockIndex = document.blocks.length - 1;
    const block = document.blocks[blockIndex];
    const element = block.elements.pop();
    const ref = elementRefs[blockIndex]?.pop();
    if (element) {
      remaining -= jsonBytes(element) + (block.elements.length > 0 ? 1 : 0);
      if (ref) droppedRefs.add(ref);
      elementIds.add(element.id);
      issues.push({
        code: "question_skipped",
        severity: "warning",
        questionTag: (ref ? survey.questions.get(ref)?.exportTag : undefined) ?? element.id,
        ...(ref ? { questionRef: ref } : {}),
        params: { cause: "draft_too_large" },
      });
    }
    if (block.elements.length === 0) {
      remaining -= jsonBytes(block) + (document.blocks.length > 1 ? 1 : 0);
      document.blocks.pop();
      elementRefs.pop();
    }
  }
  return { refs: droppedRefs, elementIds };
}

/** A recall token as the import writes it, and as the editor reads it. */
const RECALL_TOKEN = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/g;

/**
 * Recalls of cut questions, wherever the draft still has them — an ending may recall any question —
 * replaced by their fallback text, with one `piped_text_removed` line per element or ending holding
 * any. Left in, the create refuses the draft: a recall must name a question it has.
 */
function replaceRecallsOf(
  assembly: TQsfAssembly,
  survey: TQsfSurvey,
  cutIds: ReadonlySet<string>,
  issues: TQsfIssue[]
): void {
  const { document, elementRefs } = assembly;
  const replaceIn = (root: unknown): number => {
    let replaced = 0;
    for (const text of collectLocaleTexts(document, [root])) {
      for (const [code, value] of Object.entries(text)) {
        if (!value.includes("#recall:")) continue;
        text[code] = value.replaceAll(RECALL_TOKEN, (token: string, id: string, fallback: string) => {
          if (!cutIds.has(id)) return token;
          replaced += 1;
          return fallback;
        });
      }
    }
    return replaced;
  };

  document.blocks.forEach((block, blockIndex) => {
    block.elements.forEach((element, elementIndex) => {
      const count = replaceIn(element);
      if (count === 0) return;
      const ref = elementRefs[blockIndex]?.[elementIndex];
      issues.push({
        code: "piped_text_removed",
        severity: "warning",
        questionTag: (ref ? survey.questions.get(ref)?.exportTag : undefined) ?? element.id,
        ...(ref ? { questionRef: ref } : {}),
        params: { count },
      });
    });
  });
  const inEndings = replaceIn(document.endings);
  if (inEndings > 0) {
    issues.push({ code: "piped_text_removed", severity: "warning", params: { count: inEndings } });
  }
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
): { dropped: TQsfIssue[]; keepIssue: (issue: TQsfIssue) => boolean } {
  let overBy = measureQsfDraftBytes(assembly.document) - maxBytes;
  if (overBy <= 0) return { dropped: [], keepIssue: () => true };

  const dropped: TQsfIssue[] = [];
  const languagesBefore = assembly.document.languages.map((language) => language.code);
  const droppedRefs = new Set<string>();

  // The weights are exact, but the result is measured again rather than trusted, and cut further if
  // it is still over.
  while (overBy > 0 && assembly.document.blocks.length > 0) {
    overBy = dropLanguages(assembly.document, overBy, dropped);
    if (overBy > 0) {
      const cut = dropTrailingQuestions(assembly, survey, overBy, dropped);
      cut.refs.forEach((ref) => droppedRefs.add(ref));
      replaceRecallsOf(assembly, survey, cut.elementIds, dropped);
    }
    overBy = measureQsfDraftBytes(assembly.document) - maxBytes;
  }

  const kept = new Set(assembly.document.languages.map((language) => language.code));
  const droppedLanguages = new Set(languagesBefore.filter((code) => !kept.has(code)));
  const keepIssue = (issue: TQsfIssue) =>
    !(issue.code === "translation_fallback" && droppedLanguages.has(String(issue.params?.language))) &&
    !(issue.questionRef !== undefined && droppedRefs.has(issue.questionRef));
  return { dropped, keepIssue };
}

/*
 * Fitting before the work. Assembling a draft and holding it to the create's checks costs time in
 * proportion to the draft (about 1.5 s of synchronous validation at 2 MB), and every question asked of
 * the AI costs tokens. So before the AI call the survey is cut to what can fit — on an upper bound of
 * the draft's size, from the sanitized texts the draft copies — and `fitQsfDraftToCreateLimit` remains
 * the exact fit after assembly.
 */

/**
 * Room for an element's own keys and its id (up to 64 characters): ~210 for a multiple choice
 * question, the largest with options of its own, and ~430 for a contact form, whose five fields
 * replace the options.
 */
const ELEMENT_SKELETON_BYTES = 256;
const CONTACT_SKELETON_BYTES = 448;
/** An option's id and keys: `{"id":"<cuid>","label":{}},`. */
const OPTION_SKELETON_BYTES = 48;
/** A block's id and keys, besides its name. */
const BLOCK_SKELETON_BYTES = 64;
/** The document's own keys, the workspace id, an ending's keys and ids. */
const DOCUMENT_SKELETON_BYTES = 512;
/** What a piped text can grow by in assembly: `${q://QID1/…}` becoming `#recall:<id ≤ 64>/fallback:...#`. */
const RECALL_GROWTH_BYTES = 86;
/** What numbering a repeated label adds: ` (400)`. */
const LABEL_SUFFIX_BYTES = 6;
/** A hidden field id (a safe identifier of at most 64 characters), quoted, with its comma. */
const HIDDEN_FIELD_BYTES = 67;
/** `"showLanguageSwitch":true,"autoSelectLanguage":true` and their commas, on a multi-language draft. */
const LANGUAGE_SETTINGS_BYTES = 52;

/** Whether a sanitized text may show nothing: empty, blank, or markup that may hold no text. */
const mayShowNothing = (text: string | undefined): boolean =>
  text === undefined || text.trim().length === 0 || text.includes("<");

const countOf = (text: string, needle: string): number => {
  let count = 0;
  for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + needle.length)) {
    count += 1;
  }
  return count;
};

/** The most a sanitized text can weigh in the draft as a JSON string, piped text replaced. */
const textBound = (text: string | undefined): number =>
  text === undefined
    ? 2
    : jsonBytes(text) + RECALL_GROWTH_BYTES * countOf(text, "${") + countOf(text, "#recall:");

export interface TQsfSurveyFit {
  issues: TQsfIssue[];
  /** The questions cut, by Qualtrics id. */
  cutRefs: ReadonlySet<string>;
}

/**
 * Cut the survey in place, before it is planned, so its draft cannot outweigh `maxBytes`: languages
 * first, the last the file declares first (`params.order` says so), then trailing questions, and pages
 * they empty. The estimate is an upper
 * bound on the assembled draft — every text in every language as the draft writes it (a missing
 * translation is the default text, an empty headline the export tag), every option of every question
 * whatever the plan keeps, JSON escaping, piped text grown to a recall, labels numbered, and room for
 * each element's, option's and block's own keys — so nothing it keeps can push the draft over.
 *
 * A question of a type the import skips before planning (`Timing`, `CS`, …) is never in the draft, so it
 * weighs nothing, opens no page and is never cut here: it keeps its `unsupported_type` line.
 */
export function fitQsfSurveyToCreateLimit(
  survey: TQsfSurvey,
  texts: { byKey: ReadonlyMap<TQsfTextKey, ReadonlyMap<string, string>> },
  maxBytes: number = QSF_DRAFT_MAX_BYTES
): TQsfSurveyFit {
  const { defaultLanguage } = survey;
  const textIn = (key: TQsfTextKey | null, code: string) =>
    key === null ? undefined : texts.byKey.get(key)?.get(code);
  /** One locale entry: `"code":` and the comma, and the most its value can weigh. */
  const entry = (code: string, valueBytes: number) => jsonBytes(code) + 2 + valueBytes;
  const valueIn = (key: TQsfTextKey | null, code: string, fallbackBytes: number) =>
    Math.max(textBound(textIn(key, code)), textBound(textIn(key, defaultLanguage)), fallbackBytes);

  /**
   * A question's weight in one language: its headline, and its options as whichever element uses
   * the most of them. Labels are numbered only when one repeats; a contact form fills the fields its
   * options do not with empty placeholders; a consent element's label stands in the headline's text
   * only when its own default text may be empty.
   */
  const questionIn = (question: TQsfQuestion, code: string): number => {
    // An empty default headline stands in the export tag; `<` in it may be written in 3 bytes.
    const tagFallback = mayShowNothing(textIn(question.textKey, defaultLanguage))
      ? 3 * jsonBytes(question.exportTag)
      : 0;
    const headline = entry(code, valueIn(question.textKey, code, tagFallback));
    const options = [...question.choices, ...question.answers];
    if (options.length === 0) return headline;
    // As assembly writes them: a blank translation is the default text. A label with piped text or
    // markup may come out equal to another once that is resolved, so it counts as a possible repeat.
    const labels = options.map((option) => {
      const translated = textIn(option.key, code);
      return translated?.trim() ? translated : (textIn(option.key, defaultLanguage) ?? "");
    });
    const mayRepeat =
      new Set(labels.map((label) => label.trim())).size < labels.length ||
      labels.some((label) => label.includes("${") || label.includes("<"));
    const suffix = mayRepeat ? LABEL_SUFFIX_BYTES : 0;
    const optionWeight = options.reduce(
      (total, option) => total + entry(code, valueIn(option.key, code, 5) + suffix),
      0
    );
    const contactPlaceholders = Math.max(0, 5 - options.length) * entry(code, 2);
    const labelMayBeEmpty = options.some((option) => mayShowNothing(textIn(option.key, defaultLanguage)));
    return headline + Math.max(optionWeight + contactPlaceholders, labelMayBeEmpty ? headline : 0);
  };

  /** A question the draft may hold: one the plan does not skip for its type. */
  const kept = (ref: string): TQsfQuestion | undefined => {
    const question = survey.questions.get(ref);
    return question && !isUnsupportedType(question) ? question : undefined;
  };
  const questions = survey.pages.flatMap((page) => page.questionRefs.flatMap((ref) => kept(ref) ?? []));
  const endMessageIn = (code: string) =>
    survey.endMessageKey === null ? 0 : entry(code, valueIn(survey.endMessageKey, code, 0));

  // Every language but the default: its entry in `languages` and its share of each text.
  const languageWeight = (code: string) =>
    jsonBytes({ code, default: false, enabled: true }) +
    1 +
    endMessageIn(code) +
    questions.reduce((total, question) => total + questionIn(question, code), 0);

  const fixed =
    DOCUMENT_SKELETON_BYTES +
    LANGUAGE_SETTINGS_BYTES +
    3 * jsonBytes(survey.name) +
    HIDDEN_FIELD_BYTES * survey.embeddedDataNames.length +
    2 * jsonBytes(survey.endRedirectUrl ?? "") +
    jsonBytes({ code: defaultLanguage, default: true, enabled: true }) +
    endMessageIn(defaultLanguage);
  // A block is named after its Qualtrics block, or `Block <n>`.
  const pageWeight = (page: TQsfPage) =>
    BLOCK_SKELETON_BYTES + Math.max(jsonBytes(textIn(page.blockNameKey, defaultLanguage) ?? ""), 12);
  const questionWeight = (question: TQsfQuestion) => {
    const options = question.choices.length + question.answers.length;
    const skeleton =
      options === 0
        ? ELEMENT_SKELETON_BYTES
        : Math.max(ELEMENT_SKELETON_BYTES + OPTION_SKELETON_BYTES * options, CONTACT_SKELETON_BYTES);
    return skeleton + questionIn(question, defaultLanguage);
  };

  // A page becomes a block only when it holds a question the draft may hold.
  const base =
    fixed +
    survey.pages.reduce(
      (total, page) => total + (page.questionRefs.some((ref) => kept(ref)) ? pageWeight(page) : 0),
      0
    ) +
    questions.reduce((total, question) => total + questionWeight(question), 0);

  const issues: TQsfIssue[] = [];
  let total = base;
  const weights = survey.languages.map((code) => ({ code, weight: languageWeight(code) }));
  total += weights.reduce((sum, language) => sum + language.weight, 0);
  const keptLanguages = [...weights];
  while (total > maxBytes && keptLanguages.length > 0) {
    const language = keptLanguages.pop();
    if (!language) break;
    total -= language.weight;
    issues.push({
      code: "language_skipped",
      severity: "warning",
      params: { code: language.code, cause: "draft_too_large", order: "last_declared_first" },
    });
  }
  survey.languages = keptLanguages.map((language) => language.code);

  const cutRefs = new Set<string>();
  if (total > maxBytes) {
    // Trailing questions, in flow order from the end, until what is left fits.
    let running = fixed;
    for (const page of survey.pages) {
      let pageOpen = false;
      for (const ref of page.questionRefs) {
        const question = kept(ref);
        if (!question) continue;
        const weight = questionWeight(question) + (pageOpen ? 0 : pageWeight(page));
        if (cutRefs.size === 0 && running + weight <= maxBytes) {
          running += weight;
          pageOpen = true;
          continue;
        }
        cutRefs.add(ref);
        issues.push({
          code: "question_skipped",
          severity: "warning",
          questionTag: question.exportTag,
          questionRef: ref,
          params: { cause: "draft_too_large" },
        });
      }
    }
    for (const ref of cutRefs) survey.questions.delete(ref);
    // A page left with no question goes too, with its rules: there is nothing to file them under.
    survey.pages = survey.pages
      .map((page) => ({ ...page, questionRefs: page.questionRefs.filter((ref) => !cutRefs.has(ref)) }))
      .filter((page) => page.questionRefs.length > 0);
  }

  return { issues, cutRefs };
}
