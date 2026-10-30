/**
 * Default question codes and answer codes (ADR 0016, GLOSSARY "Recoding and exports").
 *
 * Pure and Zod-free, like `./codes`, so the editor, every server write path and the backfill can
 * share one definition of "what a survey that has no code yet gets". `code` stays optional in the
 * schema; this is what makes a saved or built survey coded anyway.
 *
 * Rules:
 * - Question code: the next unused `q<n>`, `n` being the highest `q` number among the survey's
 *   codes plus one. Names equal (ignoring case) to a taken name (Embedded Data) or to another
 *   question's Question ID are skipped. Existing codes are never touched, so moving or deleting
 *   questions never renumbers. A CTA gets none.
 * - Answer code: the next number after the highest numeric code already in that list, which is
 *   `1…n` in option order on a fresh list. "Other" and "none" sit last, so they take the next free
 *   number. Choices, picture choices, matrix rows and matrix columns are separate lists. NPS,
 *   rating, CSAT and CES have none.
 * - A duplicated question is an element whose `code` was dropped: it gets the next `q<n>` and its
 *   answer codes stay.
 */

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Element types whose `choices` carry answer codes. */
const CHOICE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "ranking",
  "pictureSelection",
]);

const QUESTION_CODE_PATTERN = /^q(\d+)$/i;
const NUMERIC_CODE_PATTERN = /^\d+$/;

/**
 * The counters follow existing numbers only up to a billion. A hand-typed `99999999999999999` still sits
 * in the used set, so nothing collides with it, but it must not drag a counter past 2^53: there `n + 1`
 * is `n` again, the "next unused" loop never ends, and smaller overflows print as `q1e+29`.
 */
const MAX_COUNTED_NUMBER = 1_000_000_000;
const countedNumber = (digits: string): number => {
  const value = Number(digits);
  return value <= MAX_COUNTED_NUMBER ? value : 0;
};

const forEachElement = (blocks: readonly unknown[], visit: (element: TRecord) => void): void => {
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.elements)) continue;
    for (const element of block.elements as unknown[]) {
      if (isRecord(element)) visit(element);
    }
  }
};

/** Maps every element in document order. Blocks and arrays nothing changed in keep their identity. */
const mapElements = <TBlock>(blocks: readonly TBlock[], update: (element: TRecord) => TRecord): TBlock[] => {
  const mapped = blocks.map((block): TBlock => {
    const raw: unknown = block;
    if (!isRecord(raw) || !Array.isArray(raw.elements)) return block;
    const original = raw.elements as unknown[];
    const elements = original.map((element) => (isRecord(element) ? update(element) : element));
    if (elements.every((element, index) => element === original[index])) return block;
    return { ...raw, elements } as TBlock;
  });
  return mapped.every((block, index) => block === blocks[index]) ? (blocks as TBlock[]) : mapped;
};

/** Fills `code` on the options of one list in order; returns the same array when nothing is missing. */
const fillOptionCodes = (options: unknown): unknown => {
  if (!Array.isArray(options)) return options;
  const list = options as unknown[];
  const used = new Set<string>();
  let highest = 0;
  for (const option of list) {
    if (!isRecord(option) || typeof option.code !== "string") continue;
    used.add(option.code.toLowerCase());
    if (NUMERIC_CODE_PATTERN.test(option.code)) highest = Math.max(highest, countedNumber(option.code));
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

/**
 * Returns `blocks` with every missing question code and answer code filled. Nothing is mutated;
 * blocks and elements that needed nothing keep their identity.
 *
 * @param takenNames Embedded Data names (hidden fields, variables, Embedded Data rows) a question
 *   code must not equal. Compared ignoring case.
 */
export const fillMissingCodes = <TBlock>(
  blocks: readonly TBlock[],
  takenNames: readonly string[]
): TBlock[] => {
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
    if (match) highest = Math.max(highest, countedNumber(match[1]));
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

const carryOptionCodes = (stored: unknown, next: unknown): unknown => {
  if (!Array.isArray(next) || !Array.isArray(stored)) return next;
  const nextList = next as unknown[];
  const codeById = new Map<string, string>();
  for (const option of stored as unknown[]) {
    if (isRecord(option) && typeof option.id === "string" && typeof option.code === "string") {
      codeById.set(option.id, option.code);
    }
  }
  const carried = nextList.map((option) => {
    if (!isRecord(option) || typeof option.code === "string" || typeof option.id !== "string") return option;
    const code = codeById.get(option.id);
    if (code === undefined) return option;
    return { ...option, code };
  });
  return carried.every((option, index) => option === nextList[index]) ? nextList : carried;
};

/**
 * For writes that replace a whole block (v3 block `update`): copies the stored `code` onto every
 * element, option, row and column of `nextBlocks` that arrives without one, matching by id rather
 * than position. A code the caller sent is kept. Run it before `fillMissingCodes`, so a replaced
 * block keeps its codes instead of being renumbered.
 */
export const carryOverCodes = <TBlock>(
  storedBlocks: readonly unknown[],
  nextBlocks: readonly TBlock[]
): TBlock[] => {
  const stored = new Map<string, TRecord>();
  forEachElement(storedBlocks, (element) => {
    if (typeof element.id === "string") stored.set(element.id, element);
  });

  return mapElements(nextBlocks, (element) => {
    const previous = typeof element.id === "string" ? stored.get(element.id) : undefined;
    if (!previous) return element;

    let carried = element;
    if (typeof element.code !== "string" && typeof previous.code === "string" && element.type !== "cta") {
      carried = { ...carried, code: previous.code };
    }
    for (const key of ["choices", "rows", "columns"]) {
      const options = carryOptionCodes(previous[key], element[key]);
      if (options !== element[key]) carried = { ...carried, [key]: options };
    }
    return carried;
  });
};
