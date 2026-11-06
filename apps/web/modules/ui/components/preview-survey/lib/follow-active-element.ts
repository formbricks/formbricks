/**
 * When the editor preview moves to the editor's active question (ENG-6932). The preview follows the
 * question the author is working on, but it opens like the live survey: the rules before the first
 * question, the welcome card. So the question the editor activates by itself as it opens is not
 * followed, and nothing is while no question is active (the Flow tab passes none, so editing a rule
 * there doesn't pull the preview away from the flow being tried).
 *
 * Called on every change of the active question and of the survey: a picked question stays in view
 * while it is edited, and one added before the preview has it is shown once it does.
 */

export interface TFollowState {
  /** The active question the preview last saw, `null` when none was. */
  readonly lastElementId: string | null;
  /** Whether any question was active yet: the first one is the editor's own pick. */
  readonly hasSeenElement: boolean;
  /** Whether the active question is one the author picked. */
  readonly picked: boolean;
}

export const INITIAL_FOLLOW_STATE: TFollowState = {
  lastElementId: null,
  hasSeenElement: false,
  picked: false,
};

export const followActiveElement = (
  state: TFollowState,
  elementId: string | null
): { state: TFollowState; follow: boolean } => {
  if (elementId === null) return { state: { ...state, lastElementId: null }, follow: false };
  if (!state.hasSeenElement) {
    return { state: { lastElementId: elementId, hasSeenElement: true, picked: false }, follow: false };
  }
  const picked = state.picked || elementId !== state.lastElementId;
  return { state: { lastElementId: elementId, hasSeenElement: true, picked }, follow: picked };
};
