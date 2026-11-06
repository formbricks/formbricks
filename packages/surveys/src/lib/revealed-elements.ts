/**
 * The questions a page has just revealed (ENG-6931): those shown now that weren't on the previous
 * render, because an answer on the same page met their show-if. The page scrolls the last of them into
 * view, so a follow-up appearing at the bottom of an overflowing card isn't left under the card's
 * scroll-down button. Nothing on the first render: the card opens at its top.
 */
export const getRevealedElementIds = (
  previous: readonly string[] | null,
  current: readonly string[]
): string[] => (previous === null ? [] : current.filter((id) => !previous.includes(id)));
