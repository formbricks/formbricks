/**
 * Planner for the question-code backfill (ENG-6788).
 *
 * Pure: a survey row in, "unchanged" or the full replacement for one column out. No database, no
 * app imports. A data migration must keep doing what it did on the day it shipped, so the fill rules
 * below are a deliberate copy of `fillMissingCodes` (packages/types/surveys/fill-missing-codes.ts,
 * ENG-6782) rather than an import of code that will keep changing. `utils.test.ts` runs both on the
 * same fixtures so the two cannot drift silently while this migration is still unreleased.
 *
 * Rules (ADR 0016, GLOSSARY "Recoding and exports"):
 * - Question code: the next unused `q<n>`, `n` being the highest `q` number among the survey's codes
 *   plus one, in block order then element order. Names equal (ignoring case) to an Embedded Data name
 *   or to another question's Question ID are skipped. Existing codes are never touched. A CTA gets none.
 * - Answer code: the next number after the highest numeric code already in that list, which is `1…n`
 *   by position on an uncoded list (the Gulf Cup rule). Choices, picture choices, matrix rows and
 *   matrix columns are separate lists. NPS, rating, CSAT and CES have none.
 */

type TRecord = Record<string, unknown>;

/** One survey as the migration reads it. JSON columns arrive untyped: they are legacy data. */
export interface TSurveyCodesRow {
  id: string;
  /** `updated_at` as Postgres prints it. Used only as the compare-and-set token of the write. */
  updatedAt: string;
  blocks: unknown[] | null;
  questions: unknown;
  variables: unknown;
  hiddenFields: unknown;
  /**
   * Names of the survey's Embedded Data rows, or null when it has no links. Null means "fall back to
   * the legacy `variables` / `hiddenFields` columns", the same precedence the app's
   * `collectDeclaredFieldNames` applies.
   */
  linkedNames: string[] | null;
}

export type TSurveyCodesPlan =
  | { status: "unchanged" }
  | { status: "update"; column: "blocks" | "questions"; value: unknown[] };

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const CHOICE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "ranking",
  "pictureSelection",
]);

const QUESTION_CODE_PATTERN = /^q(\d+)$/i;
const NUMERIC_CODE_PATTERN = /^\d+$/;

const forEachElement = (blocks: readonly unknown[], visit: (element: TRecord) => void): void => {
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.elements)) continue;
    for (const element of block.elements as unknown[]) {
      if (isRecord(element)) visit(element);
    }
  }
};

/** Maps every element in document order. Blocks and arrays nothing changed in keep their identity. */
const mapElements = (blocks: readonly unknown[], update: (element: TRecord) => TRecord): unknown[] => {
  const mapped = blocks.map((block) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return block;
    const original = block.elements as unknown[];
    const elements = original.map((element) => (isRecord(element) ? update(element) : element));
    if (elements.every((element, index) => element === original[index])) return block;
    return { ...block, elements };
  });
  return mapped.every((block, index) => block === blocks[index]) ? [...blocks] : mapped;
};

const fillOptionCodes = (options: unknown): unknown => {
  if (!Array.isArray(options)) return options;
  const list = options as unknown[];
  const used = new Set<string>();
  let highest = 0;
  for (const option of list) {
    if (!isRecord(option) || typeof option.code !== "string") continue;
    used.add(option.code.toLowerCase());
    if (NUMERIC_CODE_PATTERN.test(option.code)) highest = Math.max(highest, Number(option.code));
  }

  const filled = list.map((option) => {
    if (!isRecord(option) || typeof option.code === "string") return option;
    do highest += 1;
    while (used.has(String(highest)));
    used.add(String(highest));
    return { ...option, code: String(highest) };
  });
  return filled.every((option, index) => option === list[index]) ? list : filled;
};

const fillAnswerCodes = (element: TRecord): TRecord => {
  let keys: string[] = [];
  if (element.type === "matrix") keys = ["rows", "columns"];
  else if (CHOICE_ELEMENT_TYPES.has(String(element.type))) keys = ["choices"];

  let result = element;
  for (const key of keys) {
    const filled = fillOptionCodes(element[key]);
    if (filled !== element[key]) result = { ...result, [key]: filled };
  }
  return result;
};

/** Same contract as `fillMissingCodes` in `@formbricks/types`; `utils.test.ts` holds them together. */
export const fillMissingCodes = (blocks: readonly unknown[], takenNames: readonly string[]): unknown[] => {
  const takenCodes = new Set(takenNames.map((name) => name.toLowerCase()));
  const idCounts = new Map<string, number>();
  let highest = 0;

  forEachElement(blocks, (element) => {
    if (typeof element.id === "string") {
      const key = element.id.toLowerCase();
      idCounts.set(key, (idCounts.get(key) ?? 0) + 1);
    }
    if (typeof element.code !== "string") return;
    takenCodes.add(element.code.toLowerCase());
    const match = QUESTION_CODE_PATTERN.exec(element.code);
    if (match) highest = Math.max(highest, Number(match[1]));
  });

  const nextQuestionCode = (ownId: unknown): string => {
    const ownKey = typeof ownId === "string" ? ownId.toLowerCase() : undefined;
    const isFree = (candidate: string): boolean =>
      !takenCodes.has(candidate) && (idCounts.get(candidate) ?? 0) <= (candidate === ownKey ? 1 : 0);
    let candidate = `q${++highest}`;
    while (!isFree(candidate)) candidate = `q${++highest}`;
    takenCodes.add(candidate);
    return candidate;
  };

  return mapElements(blocks, (element) => {
    if (element.type === "cta") return element;
    const filled = fillAnswerCodes(element);
    return typeof element.code === "string" ? filled : { ...filled, code: nextQuestionCode(element.id) };
  });
};

/**
 * The names a question code must not take: the survey's Embedded Data rows when it has links, else the
 * legacy `variables` and `hiddenFields` columns (a survey the Embedded Data backfill never reached).
 */
export const takenNamesOf = (row: TSurveyCodesRow): string[] => {
  if (row.linkedNames !== null) return row.linkedNames;

  const variables = Array.isArray(row.variables) ? (row.variables as unknown[]) : [];
  const fieldIds =
    isRecord(row.hiddenFields) && Array.isArray(row.hiddenFields.fieldIds)
      ? (row.hiddenFields.fieldIds as unknown[])
      : [];
  return [
    ...variables.flatMap((variable) =>
      isRecord(variable) && typeof variable.name === "string" ? [variable.name] : []
    ),
    ...fieldIds.filter((fieldId): fieldId is string => typeof fieldId === "string"),
  ];
};

/**
 * Plans the write for one survey. Blocks are what the app reads; the `questions` column is only
 * filled when it is the survey's sole content (blocks empty, questions not), the legacy shape.
 * The result never differs from the input in anything but codes.
 */
export const planSurveyCodes = (row: TSurveyCodesRow): TSurveyCodesPlan => {
  const hasBlocks = Array.isArray(row.blocks) && row.blocks.length > 0;
  const column = hasBlocks ? "blocks" : "questions";
  const source = hasBlocks ? row.blocks : row.questions;
  if (!Array.isArray(source) || source.length === 0) return { status: "unchanged" };

  const taken = takenNamesOf(row);
  // A legacy question is an element without a block around it: wrap them in one so the same walk applies.
  const filled = hasBlocks
    ? fillMissingCodes(source as unknown[], taken)
    : (fillMissingCodes([{ elements: source }], taken)[0] as { elements: unknown[] }).elements;

  const changed = filled.some((item, index) => item !== source[index]);
  return changed ? { status: "update", column, value: filled } : { status: "unchanged" };
};
