/**
 * How question codes and answer codes read on the surfaces that used to show IDs (ENG-6790): the
 * Summary header, the responses table and cards, and the logic pickers. A question or option from
 * before codes existed has none yet, so the ID stands in rather than leaving an empty badge.
 */

const SEPARATOR = " · ";

/** "q1 · question text"; the plain text when the question has no code. */
export const formatCodedLabel = (code: string | undefined, text: string): string =>
  code ? `${code}${SEPARATOR}${text}` : text;

/** The question code, or the question ID while the question has no code. */
export const getElementBadgeText = (element: { id: string; code?: string }): string =>
  element.code || element.id;

/** The answer code of one option, or its ID when it has none (or is not in the list). */
export const getChoiceBadgeText = (element: object, choiceId: string): string => {
  const choices: readonly { id: string; code?: string }[] =
    "choices" in element && Array.isArray(element.choices) ? element.choices : [];
  return choices.find((choice) => choice.id === choiceId)?.code || choiceId;
};
