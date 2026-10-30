/**
 * The published lock (ADR 0015, GLOSSARY "Published").
 *
 * Once a survey has left draft (active, paused or completed; a scheduled survey is paused until its
 * publish date, so it counts) its question codes, answer codes, question types and option text are
 * locked (for a picture question, with its single or multiple selection), and an option that existed at launch
 * cannot be deleted. Responses store the label text, not an option ID, so the export finds an answer's option
 * by matching text; the lock keeps that match valid.
 *
 * A pure module over loosely typed input, like `./codes`, so the same function runs on the server in
 * every write path (`updateSurveyInternal`, v3 PATCH, block routes, MCP) and in the editor.
 *
 * The comparison is against the STORED survey, matched by element id and option id. The client's
 * `isDraft` flag is never read: it is the caller's claim, and the server only believes the stored rows.
 * Adding questions and options stays free, and a code or translation that was never set can be set.
 * A code that is omitted is not a change (the write paths carry the stored one over by id).
 * The lock prevents accidents; it is not a security control (an API caller can revert to draft).
 */

export type TPublishedLockViolationKind =
  | "question_code_changed"
  | "answer_code_changed"
  | "question_type_changed"
  | "option_text_changed"
  | "option_deleted";

export type TPublishedLockViolation = {
  kind: TPublishedLockViolationKind;
  /** Path in the NEXT survey, e.g. `["blocks", 0, "elements", 1, "choices", 2, "code"]`. A deleted option is reported at its list. */
  path: (string | number)[];
  elementId: string;
  /** The option, row or column the violation is about. */
  optionId?: string;
  /** Only for `option_text_changed`: the language key (`default`, `de`, ...) whose text changed. */
  languageCode?: string;
  message: string;
};

/**
 * Stable marker at the start of the message when a save is refused by the lock. Clients (the editor's
 * save toast) key off it instead of the wording, as with `RESPONSE_ALREADY_FINISHED_ERROR_CODE`.
 */
export const PUBLISHED_SURVEY_LOCKED_ERROR_CODE = "published_survey_locked";

export type TPublishedLockStoredSurvey = {
  status: string;
  blocks: readonly unknown[];
};

export type TPublishedLockNextSurvey = {
  blocks: readonly unknown[];
};

const OPTION_LISTS = [
  { key: "choices", noun: "option" },
  { key: "rows", noun: "row" },
  { key: "columns", noun: "column" },
] as const;

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type TLocatedElement = { raw: TRecord; id: string; blockIndex: number; elementIndex: number };

const collectElements = (blocks: readonly unknown[]): Map<string, TLocatedElement> => {
  const elements = new Map<string, TLocatedElement>();
  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return;
    block.elements.forEach((raw: unknown, elementIndex: number) => {
      if (isRecord(raw) && typeof raw.id === "string" && !elements.has(raw.id)) {
        elements.set(raw.id, { raw, id: raw.id, blockIndex, elementIndex });
      }
    });
  });
  return elements;
};

const optionsOf = (element: TRecord, key: string): TRecord[] =>
  Array.isArray(element[key]) ? element[key].filter(isRecord) : [];

const codeOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * A code that is left out is not a change: the write paths carry the stored code over by id when a
 * client (an older one, the v1 API) sends an element or option back without it (ENG-6782). Only a
 * different value is a violation.
 */
const isCodeChange = (storedCode: string, nextCode: unknown): boolean => {
  const next = codeOf(nextCode);
  return next !== undefined && next !== storedCode;
};

const labelOf = (option: TRecord): Record<string, string> => {
  if (!isRecord(option.label)) return {};
  return Object.fromEntries(
    Object.entries(option.label).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
};

type TOptionList = (typeof OPTION_LISTS)[number];

const indexOptionsById = (options: TRecord[]): Map<string, number> => {
  const indexById = new Map<string, number>();
  options.forEach((option, index) => {
    if (typeof option.id === "string" && !indexById.has(option.id)) indexById.set(option.id, index);
  });
  return indexById;
};

const checkOptionCode = (
  storedOption: TRecord,
  nextOption: TRecord,
  context: { optionId: string; elementId: string; noun: string; optionPath: (string | number)[] }
): TPublishedLockViolation[] => {
  const storedCode = codeOf(storedOption.code);
  if (storedCode === undefined || !isCodeChange(storedCode, nextOption.code)) return [];
  const { optionId, elementId, noun, optionPath } = context;
  return [
    {
      kind: "answer_code_changed",
      path: [...optionPath, "code"],
      elementId,
      optionId,
      message: `The answer code "${storedCode}" of ${noun} "${optionId}" in question "${elementId}" cannot be changed after the survey is published.`,
    },
  ];
};

const checkOptionLabels = (
  storedOption: TRecord,
  nextOption: TRecord,
  context: { optionId: string; elementId: string; noun: string; optionPath: (string | number)[] }
): TPublishedLockViolation[] => {
  const { optionId, elementId, noun, optionPath } = context;
  const nextLabel = labelOf(nextOption);
  const violations: TPublishedLockViolation[] = [];
  for (const [languageCode, storedText] of Object.entries(labelOf(storedOption))) {
    // An empty translation matched no answer, so filling it in cannot orphan one.
    if (storedText.trim() === "" || nextLabel[languageCode] === storedText) continue;
    violations.push({
      kind: "option_text_changed",
      path: [...optionPath, "label", languageCode],
      elementId,
      optionId,
      languageCode,
      message: `The ${languageCode === "default" ? "default-language" : languageCode} text of ${noun} "${optionId}" in question "${elementId}" cannot be changed after the survey is published.`,
    });
  }
  return violations;
};

const checkOptionList = (
  stored: TLocatedElement,
  next: TLocatedElement,
  list: TOptionList
): TPublishedLockViolation[] => {
  const violations: TPublishedLockViolation[] = [];
  const nextOptions = optionsOf(next.raw, list.key);
  const nextIndexById = indexOptionsById(nextOptions);
  const listPath = ["blocks", next.blockIndex, "elements", next.elementIndex, list.key];

  for (const storedOption of optionsOf(stored.raw, list.key)) {
    if (typeof storedOption.id !== "string") continue;
    const optionId = storedOption.id;
    const nextIndex = nextIndexById.get(optionId);

    if (nextIndex === undefined) {
      violations.push({
        kind: "option_deleted",
        path: listPath,
        elementId: next.id,
        optionId,
        message: `The ${list.noun} "${optionId}" of question "${next.id}" existed when the survey was published and cannot be deleted.`,
      });
      continue;
    }

    const nextOption = nextOptions[nextIndex];
    const context = {
      optionId,
      elementId: next.id,
      noun: list.noun,
      optionPath: [...listPath, nextIndex],
    };
    violations.push(
      ...checkOptionCode(storedOption, nextOption, context),
      ...checkOptionLabels(storedOption, nextOption, context)
    );
  }

  return violations;
};

/**
 * Every way `next` breaks the published lock of `stored`. Empty when the stored survey is a draft.
 * Matches by element id and option id, so reordering and moving between blocks are not violations.
 */
export const getPublishedLockViolations = (
  stored: TPublishedLockStoredSurvey,
  next: TPublishedLockNextSurvey
): TPublishedLockViolation[] => {
  if (stored.status === "draft") return [];

  const nextElements = collectElements(next.blocks);
  const violations: TPublishedLockViolation[] = [];

  for (const storedElement of collectElements(stored.blocks).values()) {
    const nextElement = nextElements.get(storedElement.id);
    // A deleted question takes its options with it; deleting questions stays allowed.
    if (!nextElement) continue;

    const elementPath = ["blocks", nextElement.blockIndex, "elements", nextElement.elementIndex];

    if (storedElement.raw.type !== nextElement.raw.type) {
      violations.push({
        kind: "question_type_changed",
        path: [...elementPath, "type"],
        elementId: nextElement.id,
        message: `The type of question "${nextElement.id}" cannot be changed after the survey is published.`,
      });
      continue;
    }

    // A picture question's selection mode is part of its type: multi to single makes the export keep the
    // first pick only, single to multi turns one column into one per image.
    if (
      storedElement.raw.type === "pictureSelection" &&
      (storedElement.raw.allowMulti === true) !== (nextElement.raw.allowMulti === true)
    ) {
      violations.push({
        kind: "question_type_changed",
        path: [...elementPath, "allowMulti"],
        elementId: nextElement.id,
        message: `The selection mode (single or multiple) of question "${nextElement.id}" cannot be changed after the survey is published.`,
      });
    }

    const storedCode = codeOf(storedElement.raw.code);
    if (storedCode !== undefined && isCodeChange(storedCode, nextElement.raw.code)) {
      violations.push({
        kind: "question_code_changed",
        path: [...elementPath, "code"],
        elementId: nextElement.id,
        message: `The question code "${storedCode}" of question "${nextElement.id}" cannot be changed after the survey is published.`,
      });
    }

    for (const list of OPTION_LISTS) {
      violations.push(...checkOptionList(storedElement, nextElement, list));
    }
  }

  return violations;
};

/** The refusal message for the non-v3 write paths: the marker, then one sentence per violation. */
export const describePublishedLockViolations = (violations: readonly TPublishedLockViolation[]): string =>
  `${PUBLISHED_SURVEY_LOCKED_ERROR_CODE}: ${violations.map((violation) => violation.message).join(" ")}`;

/** The details of a refusal message, without the marker; `null` when the message is not a lock refusal. */
export const parsePublishedLockErrorMessage = (message: string): string | null => {
  const prefix = `${PUBLISHED_SURVEY_LOCKED_ERROR_CODE}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : null;
};
