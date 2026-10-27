import type { TOptionListKey } from "./element-codes";

/**
 * What the editor locks on a published survey (ADR 0015, GLOSSARY "Published").
 *
 * This mirrors `getPublishedLockViolations` in `@formbricks/types/surveys/published-lock`, which is
 * what the server enforces: the same stored survey is the reference, matched by question id and
 * option id. A field is locked when the PERSISTED survey has left draft and already holds the thing,
 * so a question or option added since the last save stays editable, and a code or translation that
 * was never set can still be set. The client's `isDraft` flag is not read.
 */

type TRecord = Record<string, unknown>;

export type TPersistedSurveyForLock = {
  status: string;
  blocks: readonly unknown[];
};

export type TElementLock = {
  /** The persisted survey has left draft (a scheduled survey counts). */
  isActive: boolean;
  isCodeLocked: boolean;
  isTypeLocked: boolean;
  /** The option existed at launch: it cannot be deleted. */
  isOptionLocked: (list: TOptionListKey, optionId: string) => boolean;
  /** The option's text in this language existed at launch and is not empty. */
  isOptionTextLocked: (list: TOptionListKey, optionId: string, languageCode: string) => boolean;
  isAnswerCodeLocked: (list: TOptionListKey, optionId: string) => boolean;
};

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const findStoredElement = (survey: TPersistedSurveyForLock, elementId: string): TRecord | undefined => {
  for (const block of survey.blocks) {
    if (!isRecord(block) || !Array.isArray(block.elements)) continue;
    const found = block.elements.find((element) => isRecord(element) && element.id === elementId);
    if (isRecord(found)) return found;
  }
  return undefined;
};

const findStoredOption = (element: TRecord, list: TOptionListKey, optionId: string): TRecord | undefined => {
  const options: unknown = element[list];
  if (!Array.isArray(options)) return undefined;
  const found = options.find((option) => isRecord(option) && option.id === optionId);
  return isRecord(found) ? found : undefined;
};

const NOTHING_LOCKED: TElementLock = {
  isActive: false,
  isCodeLocked: false,
  isTypeLocked: false,
  isOptionLocked: () => false,
  isOptionTextLocked: () => false,
  isAnswerCodeLocked: () => false,
};

/** For an element that is not under any lock (a draft survey, or no persisted survey to compare with). */
export const NO_ELEMENT_LOCK: TElementLock = NOTHING_LOCKED;

export const getElementLock = (
  persisted: TPersistedSurveyForLock | null | undefined,
  elementId: string
): TElementLock => {
  if (!persisted || persisted.status === "draft") return NOTHING_LOCKED;

  const stored = findStoredElement(persisted, elementId);
  if (!stored) return { ...NOTHING_LOCKED, isActive: true };

  return {
    isActive: true,
    isCodeLocked: typeof stored.code === "string",
    isTypeLocked: true,
    isOptionLocked: (list, optionId) => findStoredOption(stored, list, optionId) !== undefined,
    isOptionTextLocked: (list, optionId, languageCode) => {
      const label = findStoredOption(stored, list, optionId)?.label;
      if (!isRecord(label)) return false;
      const text = label[languageCode];
      return typeof text === "string" && text.trim() !== "";
    },
    isAnswerCodeLocked: (list, optionId) =>
      typeof findStoredOption(stored, list, optionId)?.code === "string",
  };
};
