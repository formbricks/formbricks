// Where the canvas fits its flow when something overlays part of it (the Test run drawer slides in
// over its right side, without resizing it).

/** Marks the Test run drawer's panel, so the canvas can measure how much of it the drawer covers. */
export const TEST_RUN_DRAWER_ATTRIBUTE = "data-workflow-test-run-drawer";
export const TEST_RUN_DRAWER_SELECTOR = `[${TEST_RUN_DRAWER_ATTRIBUTE}]`;

/** React Flow's numeric padding: 0.25 leaves 10% of the canvas free on each side. */
export const WORKFLOW_CANVAS_FIT_PADDING = 0.25;

const SIDE_MARGIN_RATIO = 0.1;

/** Below this many visible pixels a fit would shrink the flow to nothing, so the view stays as it was. */
const MIN_VISIBLE_CANVAS_PX = 280;

export type TCanvasFitPadding =
  | number
  | { top: `${number}%`; bottom: `${number}%`; left: `${number}px`; right: `${number}px` };

/**
 * The fitView padding that keeps the flow in the visible part of the canvas: the default when
 * nothing covers it, the covered width added on the right when an overlay starts at `coverLeft`
 * (viewport x), or null when too little is left visible to fit into.
 */
export const getCanvasFitPadding = ({
  canvasLeft,
  canvasRight,
  coverLeft,
}: {
  canvasLeft: number;
  canvasRight: number;
  coverLeft: number | null;
}): TCanvasFitPadding | null => {
  if (coverLeft === null || coverLeft >= canvasRight) return WORKFLOW_CANVAS_FIT_PADDING;
  const visible = coverLeft - canvasLeft;
  if (visible < MIN_VISIBLE_CANVAS_PX) return null;
  const margin = Math.round(visible * SIDE_MARGIN_RATIO);
  const covered = canvasRight - coverLeft;
  return {
    top: `${SIDE_MARGIN_RATIO * 100}%`,
    bottom: `${SIDE_MARGIN_RATIO * 100}%`,
    left: `${margin}px`,
    right: `${covered + margin}px`,
  };
};
