import type { TSurveyImportAssembly } from "../core/draft";
import { fitDraftToCreateLimit, jsonBytes } from "../core/fit-draft";
import type { TSurveyImportPipelineIssue } from "../core/report";
import { SURVEY_IMPORT_MAX_DRAFT_BYTES } from "../limits";
import type { TQsfPage, TQsfQuestion, TQsfSurvey, TQsfTextKey } from "./qsf-model";
import { isUnsupportedType } from "./unsupported-types";

/**
 * Fit the assembled draft to the create's body limit (`fitDraftToCreateLimit`), naming a cut question
 * by its export tag.
 */
export const fitQsfDraftToCreateLimit = (
  assembly: TSurveyImportAssembly,
  survey: TQsfSurvey,
  maxBytes: number = SURVEY_IMPORT_MAX_DRAFT_BYTES
): ReturnType<typeof fitDraftToCreateLimit> =>
  fitDraftToCreateLimit(assembly, (ref) => survey.questions.get(ref)?.exportTag, maxBytes);

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
/**
 * The most the default ending's headline or subheader weighs as a JSON value in any app locale; the
 * longest is under 50 bytes. The import adds that ending, in every language, when the file has no end
 * message it can show. A test holds every locale under it.
 */
export const DEFAULT_ENDING_TEXT_BYTES = 64;
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
  issues: TSurveyImportPipelineIssue[];
  /** The questions cut, by Qualtrics id. */
  cutRefs: ReadonlySet<string>;
}

/**
 * Cut the survey in place, before it is planned, so its draft cannot outweigh `maxBytes`: languages
 * first, the last the file declares first (`params.order` says so), then trailing questions, and pages
 * they empty. The estimate is an upper
 * bound on the assembled draft — every text in every language (a missing translation, left empty in
 * the draft, counted as the default text; an empty headline as the export tag; the end message, or the
 * default ending added in its place), every option of every question whatever the plan keeps, JSON
 * escaping, piped text grown to a recall, labels numbered, and room for each element's, option's and
 * block's own keys — so nothing it keeps can push the draft over.
 *
 * A question of a type the import skips before planning (`Timing`, `CS`, …) is never in the draft, so it
 * weighs nothing, opens no page and is never cut here: it keeps its `unsupported_type` line.
 */
export function fitQsfSurveyToCreateLimit(
  survey: TQsfSurvey,
  texts: { byKey: ReadonlyMap<TQsfTextKey, ReadonlyMap<string, string>> },
  maxBytes: number = SURVEY_IMPORT_MAX_DRAFT_BYTES
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
    // A blank translation, left empty in the draft, counts as the default text. A label with piped text
    // or markup may come out equal to another once that is resolved, so it counts as a possible repeat.
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
  // The end message, or the default ending added when the file has none it can show.
  const endingIn = (code: string) =>
    Math.max(
      survey.endMessageKey === null ? 0 : entry(code, valueIn(survey.endMessageKey, code, 0)),
      2 * entry(code, DEFAULT_ENDING_TEXT_BYTES)
    );

  // Every language but the default: its entry in `languages` and its share of each text.
  const languageWeight = (code: string) =>
    jsonBytes({ code, default: false, enabled: true }) +
    1 +
    endingIn(code) +
    questions.reduce((total, question) => total + questionIn(question, code), 0);

  const fixed =
    DOCUMENT_SKELETON_BYTES +
    LANGUAGE_SETTINGS_BYTES +
    3 * jsonBytes(survey.name) +
    HIDDEN_FIELD_BYTES * survey.embeddedDataNames.length +
    2 * jsonBytes(survey.endRedirectUrl ?? "") +
    jsonBytes({ code: defaultLanguage, default: true, enabled: true }) +
    jsonBytes({ subheader: {} }) +
    endingIn(defaultLanguage);
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

  const issues: TSurveyImportPipelineIssue[] = [];
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
