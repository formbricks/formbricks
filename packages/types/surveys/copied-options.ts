import type { TConditionGroup } from "./logic";
import { getOptionListKeys } from "./show-if";

/**
 * Copied options (ENG-6938, json-shapes §3, ADR-free by design: the link is plain show-if).
 *
 * A question names the earlier question it copies its options from in `optionsCopiedFrom`. Copying
 * gives it the source's options with their option ids and answer codes (ENG-4024: one brand, one code
 * everywhere, through every hop), and each copied option an ordinary show-if "picked in the source",
 * so the survey runtime, results and the API need nothing new to honour it.
 *
 * Pure and Zod-free, so the validator, `fillMissingCodes`, the v3 checks and the editor's Recode section
 * share it. The editor no longer sets copies up (P70): they arrive through the API.
 *
 * - Choices copy from choices (single select, multi select, ranking), pictures from pictures. Matrix
 *   rows are not copied in 6.2 (decision A / P18): they use row show-if pointing at the source.
 * - The reserved options `other` (free text) and `none` (exclusive) are never copied: the target adds
 *   its own if it wants them, as a fixed option.
 * - Fixed options (any option of the target that is not a copy) stay next to the copies. Their codes
 *   are the next free in both questions, which `fillMissingCodes` takes care of.
 */

type TRecord = Record<string, unknown>;
type TElementLike = { id: string; type: string };

/** An option as copying reads and writes it: a choice or a picture choice. */
export type TCopiedOption = {
  id: string;
  code?: string;
  label?: unknown;
  imageUrl?: string;
  imageAltText?: unknown;
  showIf?: TConditionGroup;
  hidden?: boolean;
};

const PICTURE_TYPE = "pictureSelection";

/** The option ids that are never copied: "Other" asks for text, "None" is exclusive. */
const RESERVED_OPTION_IDS: ReadonlySet<string> = new Set(["other", "none"]);

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a question of this type can copy options: every type whose options are `choices` (single
 * select, multi select, ranking, picture). A matrix's rows and columns are not copied (P18).
 */
export const canHaveCopiedOptions = (type: string): boolean => getOptionListKeys(type).includes("choices");

/** What kind of options a question has to copy from, or `null` for none. */
const optionKindOf = (type: string): "choices" | "pictures" | null => {
  if (!canHaveCopiedOptions(type)) return null;
  return type === PICTURE_TYPE ? "pictures" : "choices";
};

/**
 * The question an element copies its options from, or `undefined`. Typed for every element type: only
 * single select, multi select, ranking and picture selection declare `optionsCopiedFrom`.
 */
export const getOptionsCopiedFrom = (element: object | null | undefined): string | undefined => {
  if (!element || !("optionsCopiedFrom" in element)) return undefined;
  return typeof element.optionsCopiedFrom === "string" ? element.optionsCopiedFrom : undefined;
};

/** Whether `target` can copy the options of `source`: choices from choices, pictures from pictures. */
export const canCopyOptionsBetween = (sourceType: string, targetType: string): boolean => {
  const kind = optionKindOf(sourceType);
  return kind !== null && kind === optionKindOf(targetType);
};

const getChoices = (element: unknown): TCopiedOption[] => {
  if (!isRecord(element) || !Array.isArray(element.choices)) return [];
  return element.choices.filter(
    (choice): choice is TCopiedOption => isRecord(choice) && typeof choice.id === "string"
  );
};

/** The source's options a copy brings along: all but the reserved `other` and `none`. */
const getCopyableOptions = (source: unknown): TCopiedOption[] =>
  getChoices(source).filter((option) => !RESERVED_OPTION_IDS.has(option.id));

/**
 * The ids of the target's options that are copies of the source's: the target's options whose id is
 * one of the source's copyable options. Everything else in the target is a fixed option.
 */
export const getCopiedOptionIds = (source: unknown, target: unknown): Set<string> => {
  const sourceIds = new Set(getCopyableOptions(source).map((option) => option.id));
  return new Set(
    getChoices(target)
      .map((option) => option.id)
      .filter((id) => sourceIds.has(id))
  );
};

/**
 * The show-if a copied option carries: "picked in the source". A single select's answer is one
 * option (`equals`); a multi select, a ranking and a picture selection hold several (`includesOneOf`).
 */
export const getPickedInSourceShowIf = (
  source: TElementLike,
  optionId: string,
  createId: () => string
): TConditionGroup => ({
  id: createId(),
  connector: "and",
  conditions: [
    source.type === "multipleChoiceSingle"
      ? {
          id: createId(),
          leftOperand: { type: "element", value: source.id },
          operator: "equals",
          rightOperand: { type: "static", value: optionId },
        }
      : {
          id: createId(),
          leftOperand: { type: "element", value: source.id },
          operator: "includesOneOf",
          rightOperand: { type: "static", value: [optionId] },
        },
  ],
});

/** Whether a show-if is exactly "picked in `source`" for `optionId`, ignoring ids. */
const isPickedInSourceShowIf = (showIf: unknown, source: TElementLike, optionId: string): boolean => {
  if (!isRecord(showIf) || showIf.connector !== "and" || !Array.isArray(showIf.conditions)) return false;
  if (showIf.conditions.length !== 1) return false;
  const expected = getPickedInSourceShowIf(source, optionId, () => "").conditions[0];
  const actual: unknown = showIf.conditions[0];
  if (!isRecord(actual) || !("operator" in expected)) return false;
  return (
    JSON.stringify(actual.leftOperand) === JSON.stringify(expected.leftOperand) &&
    actual.operator === expected.operator &&
    JSON.stringify(actual.rightOperand) === JSON.stringify(expected.rightOperand)
  );
};

/** The source option as a copy: its id, code and content, without the source's own show-if or Hidden. */
const toCopy = (option: TCopiedOption, existing: TCopiedOption | undefined, showIf: TConditionGroup) => {
  const { showIf: _showIf, hidden: _hidden, ...content } = option;
  return {
    ...content,
    showIf,
    ...(existing?.hidden === true ? { hidden: true } : {}),
  } as TCopiedOption;
};

export interface TCopyOptionsSettings {
  /** Makes the show-if ids (cuid2 in the survey document). */
  createId: () => string;
  /**
   * A first copy (the target did not copy from this source yet) replaces the target's own options,
   * except the reserved `other` / `none` and those this returns true for: on a published survey, the
   * options that existed at launch, which may not be deleted.
   */
  keepOptionId?: (optionId: string) => boolean;
}

/**
 * The target's options after copying the source's ("Options copied from", and "Copy again").
 *
 * - The copies come first, in the source's order, each with the source's id, code and content and a
 *   "picked in the source" show-if. A copy the target already had keeps its show-if when it still is
 *   "picked in the source" (so a re-copy changes nothing it doesn't need to), and its Hidden flag.
 * - The target's fixed options follow, in their order. On a first copy from this source the target's
 *   own options are dropped, except the reserved ones and `keepOptionId`.
 */
export const copyOptionsFrom = (
  source: TElementLike,
  target: TElementLike & { optionsCopiedFrom?: unknown },
  { createId, keepOptionId = () => false }: TCopyOptionsSettings
): TCopiedOption[] => {
  const targetOptions = getChoices(target);
  const existingById = new Map(targetOptions.map((option) => [option.id, option]));
  const isRecopy = target.optionsCopiedFrom === source.id;

  const copies = getCopyableOptions(source).map((option) => {
    const existing = existingById.get(option.id);
    const showIf =
      existing && isPickedInSourceShowIf(existing.showIf, source, option.id)
        ? (existing.showIf as TConditionGroup)
        : getPickedInSourceShowIf(source, option.id, createId);
    return toCopy(option, existing, showIf);
  });

  const copiedIds = new Set(copies.map((option) => option.id));
  const fixed = targetOptions.filter((option) => {
    if (copiedIds.has(option.id)) return false;
    return isRecopy || RESERVED_OPTION_IDS.has(option.id) || keepOptionId(option.id);
  });

  return [...copies, ...fixed];
};

/** One problem with a question's `optionsCopiedFrom`, with the exact path from the survey root. */
export type TCopiedOptionsIssue = {
  kind: "missing_source" | "self_source" | "later_source" | "no_options" | "incompatible_source";
  path: (string | number)[];
  sourceId: string;
  message: string;
};

type TPositioned = { blockIndex: number; elementIndex: number; flatIndex: number; element: TRecord };

const collectElements = (blocks: readonly unknown[]): TPositioned[] => {
  const elements: TPositioned[] = [];
  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return;
    block.elements.forEach((element: unknown, elementIndex: number) => {
      if (isRecord(element)) elements.push({ blockIndex, elementIndex, flatIndex: elements.length, element });
    });
  });
  return elements;
};

const INCOMPATIBLE_REASON = {
  choices: "choices can only be copied from a single select, multi select or ranking",
  pictures: "pictures can only be copied from a picture selection",
} as const;

/**
 * Every problem with the `optionsCopiedFrom` links of a survey, in document order: the source must
 * exist, sit in an earlier block or above the question on its page, and have options of a compatible
 * kind. A question whose type cannot copy options is not checked (the schema strips the key there).
 */
export const getCopiedOptionsIssues = (blocks: readonly unknown[]): TCopiedOptionsIssue[] => {
  const elements = collectElements(blocks);
  const byId = new Map<string, TPositioned>();
  for (const entry of elements) {
    const id = entry.element.id;
    if (typeof id === "string" && !byId.has(id)) byId.set(id, entry);
  }

  const issues: TCopiedOptionsIssue[] = [];
  for (const { blockIndex, elementIndex, flatIndex, element } of elements) {
    const sourceId = element.optionsCopiedFrom;
    if (typeof sourceId !== "string") continue;
    const targetKind = optionKindOf(String(element.type));
    if (!targetKind) continue;

    const path = ["blocks", blockIndex, "elements", elementIndex, "optionsCopiedFrom"];
    const owner = `question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)}`;
    const lead = `Copied options: ${owner} copies its options from "${sourceId}"`;
    const source = byId.get(sourceId);

    if (!source) {
      issues.push({ kind: "missing_source", path, sourceId, message: `${lead}, which does not exist` });
    } else if (source.element === element) {
      issues.push({ kind: "self_source", path, sourceId, message: `${lead}, which is the question itself` });
    } else if (source.flatIndex > flatIndex) {
      issues.push({
        kind: "later_source",
        path,
        sourceId,
        message: `${lead}, which is not above it. Options can be copied from earlier blocks and from questions above it on the same page`,
      });
    } else if (optionKindOf(String(source.element.type)) === null) {
      issues.push({ kind: "no_options", path, sourceId, message: `${lead}, which has no options to copy` });
    } else if (!canCopyOptionsBetween(String(source.element.type), String(element.type))) {
      issues.push({
        kind: "incompatible_source",
        path,
        sourceId,
        message: `${lead}, but ${INCOMPATIBLE_REASON[targetKind]}`,
      });
    }
  }
  return issues;
};

/**
 * For codes (ENG-4024): every question linked by copying, grouped. Questions in one group share their
 * answer codes: a copy carries the source's code, and a fixed option anywhere in the group takes a
 * code no question of the group uses. Keyed by element id; questions in no link are left out.
 */
export const getCopyGroups = (blocks: readonly unknown[]): Map<string, string> => {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string;
    return root;
  };
  const elements = collectElements(blocks);
  const ids = new Set(elements.map(({ element }) => element.id).filter((id) => typeof id === "string"));

  for (const { element } of elements) {
    const sourceId = element.optionsCopiedFrom;
    if (typeof element.id !== "string" || typeof sourceId !== "string" || !ids.has(sourceId)) continue;
    if (!canHaveCopiedOptions(String(element.type))) continue;
    for (const id of [element.id, sourceId]) if (!parent.has(id)) parent.set(id, id);
    const a = find(element.id);
    const b = find(sourceId);
    if (a !== b) parent.set(a, b);
  }

  const groups = new Map<string, string>();
  for (const id of parent.keys()) groups.set(id, find(id));
  return groups;
};
