/** How close to the bottom still counts as "following along", in px. */
export const PIN_THRESHOLD_PX = 32;

type TScrollMetrics = Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">;

/** Whether the list is close enough to its end that new questions should keep it there. */
export const isPinnedToBottom = ({ scrollHeight, scrollTop, clientHeight }: TScrollMetrics): boolean =>
  scrollHeight - scrollTop - clientHeight < PIN_THRESHOLD_PX;

/**
 * What a change in `isGenerating` asks of the list. A new generation follows its questions down again,
 * even if the user scrolled away during the last one. A finished one goes back to the first question,
 * so the review (or an import that lands all at once) is read from the top.
 */
export const getGenerationScrollAction = (
  wasGenerating: boolean,
  isGenerating: boolean
): "repin" | "scroll_to_top" | null => {
  if (isGenerating && !wasGenerating) return "repin";
  if (wasGenerating && !isGenerating) return "scroll_to_top";
  return null;
};

/** New questions pull the list down only while generating and while the user is following along. */
export const shouldFollowNewQuestions = (isGenerating: boolean, isPinned: boolean): boolean =>
  isGenerating && isPinned;
