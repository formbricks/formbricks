import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";

/** Id of the visually-hidden region holding the survey's persistent instructions. */
export const SURVEY_INSTRUCTIONS_ID = "fb__survey-instructions";

export interface TSurveyPagePosition {
  /** 1-based position of the card currently shown. */
  index: number;
  /** Total number of cards: welcome (when enabled) + one per block + one ending (when any). */
  total: number;
}

/**
 * "Page n of m" for the card currently shown, so a host can put the respondent's position in the
 * document title (WCAG 2.4.2).
 *
 * Counts cards the way the progress bar already does — welcome when enabled, one per block, one for
 * the ending — so the two can never disagree about how long the survey is. Branching logic means a
 * respondent may not visit every block, so this is a position within the survey rather than a count
 * of the cards they will actually see; that is the same approximation the progress bar accepts.
 *
 * `blockId` is the renderer's card pointer: `"start"` for the welcome card, a block id while
 * answering, and an ending id at the end.
 */
export const getSurveyPagePosition = (
  survey: TJsWorkspaceStateSurvey,
  blockId: string
): TSurveyPagePosition => {
  const welcomeOffset = survey.welcomeCard.enabled ? 1 : 0;
  const hasEnding = survey.endings.length > 0;
  // A survey always has at least one block, but clamp anyway rather than report "page 1 of 0".
  const total = Math.max(1, welcomeOffset + survey.blocks.length + (hasEnding ? 1 : 0));

  // "start" is the welcome card, or the first block when the welcome card is disabled. Either way
  // it is the first page.
  if (blockId === "start") return { index: 1, total };

  const blockIndex = survey.blocks.findIndex((block) => block.id === blockId);
  if (blockIndex >= 0) return { index: welcomeOffset + blockIndex + 1, total };

  // Not a block: an ending card, or an id that no longer resolves after the survey was edited
  // mid-session. The last page either way.
  return { index: total, total };
};

/**
 * Whether the survey has instructions worth exposing on every page.
 *
 * The welcome card's subheader is the only instructions text a survey has — there is no
 * `survey.description` — and today it disappears the moment the respondent advances past the
 * welcome card. Checks every localization rather than just `default`, because a survey may leave
 * the default empty and fill only its translations.
 */
export const hasSurveyInstructions = (survey: TJsWorkspaceStateSurvey): boolean =>
  Object.values(survey.welcomeCard.subheader ?? {}).some((value) => value.trim().length > 0);
