/**
 * The editor's vertical budget: the viewport minus the app shell chrome above the canvas (global
 * nav, breadcrumbs, page title, secondary nav) plus the page's bottom padding.
 *
 * The canvas takes this as a fixed height and the inspector as a cap, so neither column can grow
 * the page: both scroll internally instead. Kept as one shared literal because the two must agree —
 * if the inspector's cap exceeded the canvas height, a long config form would push the app shell's
 * scroll container and a window-level scrollbar would appear over an editor that cannot use it (the
 * canvas is `overflow-hidden` at a fixed height, so scrolling the page just reveals blank space).
 *
 * The 224px is measured, not guessed: at 220px the columns came out 3px taller than the shell's
 * scroll container, which is enough for a scrollbar. The chrome above is fixed-height, so the
 * correction is a constant and holds at any viewport height.
 *
 * Written as complete class names, not interpolated, so Tailwind's scanner can see them.
 */
export const WORKFLOW_EDITOR_COLUMN_HEIGHT_CLASS = "h-[calc(100vh-224px)]";
export const WORKFLOW_EDITOR_COLUMN_MAX_HEIGHT_CLASS = "max-h-[calc(100vh-224px)]";
