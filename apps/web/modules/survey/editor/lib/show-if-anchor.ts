/**
 * Marks the row a show-if popover lines up with and spans: a Questions-tab show-if section, a Flow-tab
 * question row or block header (review of ENG-6969). The popover opens under the whole row,
 * left-aligned with it, on both tabs; without a marked row it opens under its trigger.
 */
export const SHOW_IF_ANCHOR_PROPS = { "data-show-if-anchor": "" } as const;

const SHOW_IF_ANCHOR_SELECTOR = "[data-show-if-anchor]";

/** The element a show-if popover anchors to: the trigger's nearest marked row, else the trigger. */
export const findShowIfAnchor = <T extends Pick<Element, "closest">>(trigger: T): Element | T =>
  trigger.closest(SHOW_IF_ANCHOR_SELECTOR) ?? trigger;
