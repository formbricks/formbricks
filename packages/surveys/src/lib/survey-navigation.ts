/**
 * Resolving the renderer's card pointer, `blockId`, against the survey.
 *
 * `blockId` is a union: the `"start"` sentinel for the welcome card, a block id while the
 * respondent is answering, an ending id once the survey is over, and the `"end"` sentinel for a
 * survey that has no endings at all. A *block*, though, is only resolvable against
 * `survey.blocks` — so `blocks.findIndex(...)` returns `-1` for every other member of that union
 * and `blocks[-1]` is `undefined`.
 *
 * That disagreement used to surface as a thrown `Block not found` on navigation (ENG-2818). The
 * throw escaped as an unhandled rejection, so on a link survey the answer in hand was never
 * queued and the Next button was left spinning. These helpers hold the two resolutions the
 * navigation paths need, so "`blockId` is not a block" has one defined answer per direction.
 */

/** The `blockId` sentinel for a finished survey that defines no ending cards. */
export const END_BLOCK_ID = "end";

/** The `blockId` sentinel for the welcome card. */
export const START_BLOCK_ID = "start";

interface TNavigableSurvey {
  blocks: readonly { readonly id: string }[];
  endings: readonly { readonly id: string }[];
}

/**
 * Whether `blockId` means "this survey is over" — an ending card, or the `"end"` sentinel used
 * when the survey defines none.
 *
 * Restored offline progress is validated against this: a saved position that is already an
 * ending is a finished session, not somewhere to resume.
 */
export const isFinishedBlockId = (survey: TNavigableSurvey, blockId: string): boolean =>
  blockId === END_BLOCK_ID || survey.endings.some((ending) => ending.id === blockId);

/**
 * The target a forward navigation should settle on when `blockId` does not resolve to a block.
 *
 * Reached from three states, all of them normal: `blockId` is an ending id (the survey already
 * finished), it is the `"end"` sentinel, or it names a block that no longer exists because the
 * creator edited the survey after progress was saved. None of them leaves anything to advance
 * through, so the survey finishes:
 *
 * - an ending id returns itself, keeping the ending already on screen and the persisted
 *   `endingId` in agreement with it;
 * - anything else returns `undefined`, which the caller reads as "no target" and falls back to
 *   the first ending, exactly as it does when a respondent runs off the last block.
 */
export const getForwardTargetFromOffBlockId = (
  survey: TNavigableSurvey,
  blockId: string
): string | undefined => survey.endings.find((ending) => ending.id === blockId)?.id;

/**
 * The card a Back navigation should return to, or `undefined` when nothing precedes the current
 * one — in which case Back is a no-op.
 *
 * Visited cards are the source of truth: branching logic means the block sitting before the
 * current one in the array is not necessarily the one the respondent came from. `history` may
 * hold the `"start"` sentinel, which correctly returns the respondent to the welcome card.
 *
 * With no history there is only the array order to fall back on, and an index of `0` (the first
 * block) or `-1` (an ending, a sentinel, or a block deleted since progress was saved) both mean
 * there is nowhere to go back to.
 */
export const getPreviousBlockId = (
  survey: TNavigableSurvey,
  blockId: string,
  history: readonly string[]
): string | undefined => {
  if (history.length > 0) return history[history.length - 1];

  const currentBlockIndex = survey.blocks.findIndex((block) => block.id === blockId);
  if (currentBlockIndex <= 0) return undefined;

  return survey.blocks[currentBlockIndex - 1].id;
};
