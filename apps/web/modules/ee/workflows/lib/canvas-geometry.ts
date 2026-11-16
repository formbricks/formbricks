// Canvas spacing shared by the layout (definition-to-flow), the editor atoms that place new steps,
// and the If/else and Switch cards that draw their fork. It imports nothing, so the editor state can use it
// without importing definition-to-flow (which imports the state's types).

/** One layout column (x) and one row (y) between a step and the next. */
export const WORKFLOW_CANVAS_NODE_SPACING = { x: 360, y: 120 };

export const WORKFLOW_CANVAS_START_POSITION = { x: 220, y: 80 };

/**
 * From an If/else or Switch card's top to the first step of its branches: the card, its fork with
 * the branch labels, and the edge down to the step.
 */
export const WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT = 200;

/** Distance between two neighbouring legs of a fork (Then and Else, two Switch branches): one column. */
export const WORKFLOW_CANVAS_BRANCH_SPREAD = WORKFLOW_CANVAS_NODE_SPACING.x;

/** From the top of the fork under an If/else or Switch card to its bar, where each branch's line starts. */
export const WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP = 20;

/**
 * The connector line every edge and fork on the canvas is drawn with (slate-300), so a branch's line
 * looks the same as the one from the trigger to its step.
 */
export const WORKFLOW_CANVAS_CONNECTOR = { color: "#cbd5e1", width: 1.5 } as const;

/**
 * Where each leg of a branching step's fork sits, as an x offset from the step's centre, left to right.
 * `childOffsets` holds, per leg, the offset of the branch's first step (null while the branch is
 * empty). A leg with a step sits right above it, so the line runs straight down from the fork bar to
 * the step wherever the layout or the user put it. An empty leg sits one column beside its nearest
 * neighbour with a step, in branch order, or, with no step on any leg, the legs spread one column
 * apart, centred under the step.
 */
export const getBranchLegOffsets = (childOffsets: ReadonlyArray<number | null>): number[] => {
  const count = childOffsets.length;
  return childOffsets.map((offset, index) => {
    if (offset !== null) return offset;
    for (let left = index - 1; left >= 0; left--) {
      const leftOffset = childOffsets[left];
      if (leftOffset !== null) return leftOffset + (index - left) * WORKFLOW_CANVAS_BRANCH_SPREAD;
    }
    for (let right = index + 1; right < count; right++) {
      const rightOffset = childOffsets[right];
      if (rightOffset !== null) return rightOffset - (right - index) * WORKFLOW_CANVAS_BRANCH_SPREAD;
    }
    return (index - (count - 1) / 2) * WORKFLOW_CANVAS_BRANCH_SPREAD;
  });
};

/**
 * Where a step appended after `source` goes: straight below, or, with the x offset of its branch's
 * leg (see getBranchLegOffsets), one branch row below under that leg. Every card is the same width,
 * so a centre offset is also the offset between the cards' positions.
 */
export const getAppendedStepPosition = (
  source: { x: number; y: number },
  legOffset?: number | null
): { x: number; y: number } => {
  if (legOffset === undefined || legOffset === null) {
    return { x: source.x, y: source.y + WORKFLOW_CANVAS_NODE_SPACING.y };
  }
  return { x: source.x + legOffset, y: source.y + WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT };
};
