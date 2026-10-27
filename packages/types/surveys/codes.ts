/**
 * Question codes and answer codes (ADR 0016, GLOSSARY "Recoding and exports").
 *
 * A pure module: no Zod, no survey schema imports. It runs from `surveyRefinement` (editor, v1, v3
 * create) and from `validateV3SurveyDocument` (v3 PATCH, block routes, MCP), so both gates share one
 * definition of what a code may be.
 *
 * Codes are optional everywhere. A survey stored before codes existed has none, and `undefined`
 * means "not coded yet", never an error. Only a code that is *present* is validated.
 */

export const QUESTION_CODE_MAX_LENGTH = 30;
export const ANSWER_CODE_MAX_LENGTH = 20;

/**
 * Words SPSS refuses as variable names. Lowercase, because codes are.
 * Exported as an array so a test (and the export tickets) can enumerate it.
 */
export const SPSS_RESERVED_WORDS: readonly string[] = [
  "all",
  "and",
  "by",
  "eq",
  "ge",
  "gt",
  "le",
  "lt",
  "ne",
  "not",
  "or",
  "to",
  "with",
];

/**
 * Column names the export writes itself, so a code must not take one: a question coded `outcome`
 * would put two columns of the same name into the file. Extend this list in the export work
 * (ENG-6789) when a column is added; being listed here is what keeps a code off it.
 */
export const EXPORT_COLUMN_NAMES: readonly string[] = [
  "response_id",
  "timestamp",
  "created_at",
  "finished",
  "survey_id",
  "user_id",
  "contact_id",
  "tags",
  "quotas",
  "verified_email",
  "language",
  "outcome",
  "notes",
];

const SPSS_RESERVED_SET: ReadonlySet<string> = new Set(SPSS_RESERVED_WORDS);
const EXPORT_COLUMN_SET: ReadonlySet<string> = new Set(EXPORT_COLUMN_NAMES);

export type TCodeFormatReason =
  | "empty"
  | "must_start_with_lowercase_letter"
  | "must_start_with_letter_or_digit"
  | "invalid_characters"
  | "double_underscore"
  | "trailing_underscore"
  | "too_long"
  | "spss_reserved_word"
  | "export_column_name";

const CODE_CHARSET = /^[a-z0-9_]+$/;

/** What every code must satisfy once its first character is known to be allowed. */
const checkBody = (code: string, maxLength: number): TCodeFormatReason | null => {
  if (!CODE_CHARSET.test(code)) return "invalid_characters";
  if (code.includes("__")) return "double_underscore";
  if (code.endsWith("_")) return "trailing_underscore";
  if (code.length > maxLength) return "too_long";
  if (SPSS_RESERVED_SET.has(code)) return "spss_reserved_word";
  if (EXPORT_COLUMN_SET.has(code)) return "export_column_name";
  return null;
};

/**
 * `null` when `code` is a valid question code, otherwise the first rule it breaks: starts with a
 * lowercase letter, then lowercase letters, digits and `_`; no `__`; no trailing `_`; at most 30
 * characters; not an SPSS reserved word or an export column name.
 */
export const validateQuestionCodeFormat = (code: string): TCodeFormatReason | null => {
  if (code.length === 0) return "empty";
  if (!/^[a-z]/.test(code)) return "must_start_with_lowercase_letter";
  return checkBody(code, QUESTION_CODE_MAX_LENGTH);
};

/**
 * `null` when `code` is a valid answer code. Same characters as a question code, but a digit may
 * lead (`1`, `98`) and the limit is 20. It may not start with `_` either, so that
 * `<question>_<answer>` never contains `__` (Zapier reads `__` as nesting).
 */
export const validateAnswerCodeFormat = (code: string): TCodeFormatReason | null => {
  if (code.length === 0) return "empty";
  if (!CODE_CHARSET.test(code)) return "invalid_characters";
  if (code.startsWith("_")) return "must_start_with_letter_or_digit";
  return checkBody(code, ANSWER_CODE_MAX_LENGTH);
};

const REASON_TEXT: Record<TCodeFormatReason, (maxLength: number) => string> = {
  empty: () => "must not be empty",
  must_start_with_lowercase_letter: () => "must start with a lowercase letter",
  must_start_with_letter_or_digit: () => "must start with a lowercase letter or a digit",
  invalid_characters: () => "may only contain lowercase letters, digits and underscores",
  double_underscore: () => "must not contain two underscores in a row",
  trailing_underscore: () => "must not end with an underscore",
  too_long: (maxLength) => `must be at most ${maxLength} characters`,
  spss_reserved_word: () => "is an SPSS reserved word",
  export_column_name: () => "is the name of an export column",
};

export type TCodeIssueKind =
  | "invalid_format"
  | "duplicate_question_code"
  | "clashes_embedded_data"
  | "clashes_question_id"
  | "duplicate_answer_code";

export type TCodeIssue = {
  kind: TCodeIssueKind;
  /** Path from the survey root, e.g. `["blocks", 0, "elements", 1, "choices", 2, "code"]`. */
  path: (string | number)[];
  /** The offending code as written. */
  value: string;
  message: string;
  /** Only for `invalid_format`. */
  reason?: TCodeFormatReason;
  /** The element id, option id or Embedded Data name the code collides with (the clash kinds). */
  clashesWith?: string;
};

export type TSurveyCodesInput = {
  /** `survey.blocks`, or anything shaped like it; entries that are not blocks are skipped. */
  blocks: readonly unknown[];
  /**
   * Every Embedded Data name the survey declares: hidden fields, variables and Embedded Data rows
   * (`collectDeclaredFieldNames`). Omit when the caller has none.
   */
  embeddedDataNames?: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type TOptionList = { key: "choices" | "rows" | "columns"; noun: string };
const OPTION_LISTS: readonly TOptionList[] = [
  { key: "choices", noun: "option" },
  { key: "rows", noun: "row" },
  { key: "columns", noun: "column" },
];

type TCodedElement = {
  id: string;
  code: string | undefined;
  blockIndex: number;
  elementIndex: number;
  raw: Record<string, unknown>;
};

const collectElements = (blocks: readonly unknown[]): TCodedElement[] => {
  const elements: TCodedElement[] = [];
  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return;
    block.elements.forEach((raw: unknown, elementIndex: number) => {
      if (!isRecord(raw) || typeof raw.id !== "string") return;
      elements.push({
        id: raw.id,
        code: typeof raw.code === "string" ? raw.code : undefined,
        blockIndex,
        elementIndex,
        raw,
      });
    });
  });
  return elements;
};

const validateAnswerCodes = (element: TCodedElement): TCodeIssue[] => {
  const issues: TCodeIssue[] = [];
  for (const { key, noun } of OPTION_LISTS) {
    const options = element.raw[key];
    if (!Array.isArray(options)) continue;

    const firstUse = new Map<string, string>();
    options.forEach((option: unknown, optionIndex: number) => {
      if (!isRecord(option) || typeof option.code !== "string") return;
      const path = ["blocks", element.blockIndex, "elements", element.elementIndex, key, optionIndex, "code"];
      const value = option.code;
      const optionId = typeof option.id === "string" ? option.id : String(optionIndex);

      const reason = validateAnswerCodeFormat(value);
      if (reason) {
        issues.push({
          kind: "invalid_format",
          reason,
          path,
          value,
          message: `Answer code "${value}" of question "${element.id}" ${REASON_TEXT[reason](ANSWER_CODE_MAX_LENGTH)}.`,
        });
        return;
      }

      const lowered = value.toLowerCase();
      const first = firstUse.get(lowered);
      if (first === undefined) {
        firstUse.set(lowered, optionId);
        return;
      }
      issues.push({
        kind: "duplicate_answer_code",
        path,
        value,
        clashesWith: first,
        message: `Answer code "${value}" is already used by ${noun} "${first}" of question "${element.id}".`,
      });
    });
  }
  return issues;
};

/**
 * Every code problem in a survey, in document order: format, then uniqueness.
 *
 * - Question codes are unique among themselves, against Embedded Data names and against *other*
 *   questions' Question IDs, ignoring case. A question's own ID may equal its own code.
 * - Answer codes are unique within their question; a matrix's rows and columns are separate lists.
 * - CTA elements have no code, so one is ignored rather than validated.
 */
export const validateSurveyCodes = ({ blocks, embeddedDataNames = [] }: TSurveyCodesInput): TCodeIssue[] => {
  const elements = collectElements(blocks);
  const embeddedByName = new Map(embeddedDataNames.map((name) => [name.toLowerCase(), name]));
  const idsByLowercase = new Map<string, { id: string; elementIndexInList: number }[]>();
  elements.forEach((element, index) => {
    const key = element.id.toLowerCase();
    idsByLowercase.set(key, [
      ...(idsByLowercase.get(key) ?? []),
      { id: element.id, elementIndexInList: index },
    ]);
  });

  const issues: TCodeIssue[] = [];
  const firstUse = new Map<string, string>();

  elements.forEach((element, index) => {
    if (element.raw.type === "cta") return;

    if (element.code !== undefined) {
      const path = ["blocks", element.blockIndex, "elements", element.elementIndex, "code"];
      const value = element.code;
      const reason = validateQuestionCodeFormat(value);

      if (reason) {
        issues.push({
          kind: "invalid_format",
          reason,
          path,
          value,
          message: `Question code "${value}" of question "${element.id}" ${REASON_TEXT[reason](QUESTION_CODE_MAX_LENGTH)}.`,
        });
      } else {
        const lowered = value.toLowerCase();
        const embedded = embeddedByName.get(lowered);
        const otherId = idsByLowercase.get(lowered)?.find((entry) => entry.elementIndexInList !== index);
        const first = firstUse.get(lowered);

        if (first !== undefined) {
          issues.push({
            kind: "duplicate_question_code",
            path,
            value,
            clashesWith: first,
            message: `Question code "${value}" is already used by question "${first}".`,
          });
        } else if (embedded !== undefined) {
          issues.push({
            kind: "clashes_embedded_data",
            path,
            value,
            clashesWith: embedded,
            message: `Question code "${value}" is already used by the Embedded Data field "${embedded}".`,
          });
        } else if (otherId !== undefined) {
          issues.push({
            kind: "clashes_question_id",
            path,
            value,
            clashesWith: otherId.id,
            message: `Question code "${value}" is already used by the Question ID of question "${otherId.id}".`,
          });
        }
        if (first === undefined) firstUse.set(lowered, element.id);
      }
    }

    issues.push(...validateAnswerCodes(element));
  });

  return issues;
};
