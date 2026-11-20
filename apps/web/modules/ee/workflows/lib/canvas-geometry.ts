import type { TWorkflowCanvasDirection, TWorkflowDefinition } from "@formbricks/workflows";

// Canvas spacing shared by the layout (definition-to-flow), the editor atoms that place new steps,
// and the If/else and Switch cards that draw their fork. It imports only types, so the editor state can
// use it without importing definition-to-flow (which imports the state's types).

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

/** Which way the canvas reads: top to bottom (the default) or left to right. */
export type { TWorkflowCanvasDirection };

/**
 * Left to right: every card is one height, so a branch's leg, at its first step's offset, lines up
 * with that step's centre. A step and the next are one `stepWidth` apart (card plus the gap for its
 * line or `+`), an If/else or Switch and its branches' steps one `branchStepWidth` (card, fork and the
 * labelled legs), and branches one `rowHeight` apart.
 */
export const WORKFLOW_CANVAS_HORIZONTAL = {
  cardHeight: 88,
  stepWidth: 360,
  branchStepWidth: 480,
  rowHeight: 120,
  /** From the card's right edge to the fork's bar. */
  forkBarLeft: 20,
} as const;

/** Distance between two neighbouring legs of a fork, for the direction the canvas reads. */
export const getBranchSpread = (direction: TWorkflowCanvasDirection): number =>
  direction === "horizontal" ? WORKFLOW_CANVAS_HORIZONTAL.rowHeight : WORKFLOW_CANVAS_BRANCH_SPREAD;

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
export const getBranchLegOffsets = (
  childOffsets: ReadonlyArray<number | null>,
  spread: number = WORKFLOW_CANVAS_BRANCH_SPREAD
): number[] => {
  const count = childOffsets.length;
  return childOffsets.map((offset, index) => {
    if (offset !== null) return offset;
    for (let left = index - 1; left >= 0; left--) {
      const leftOffset = childOffsets[left];
      if (leftOffset !== null) return leftOffset + (index - left) * spread;
    }
    for (let right = index + 1; right < count; right++) {
      const rightOffset = childOffsets[right];
      if (rightOffset !== null) return rightOffset - (right - index) * spread;
    }
    return (index - (count - 1) / 2) * spread;
  });
};

/**
 * Where a step appended after `source` goes: straight below, or, with the x offset of its branch's
 * leg (see getBranchLegOffsets), one branch row below under that leg. Every card is the same width,
 * so a centre offset is also the offset between the cards' positions.
 */
export const getAppendedStepPosition = (
  source: { x: number; y: number },
  legOffset?: number | null,
  direction: TWorkflowCanvasDirection = "vertical"
): { x: number; y: number } => {
  if (direction === "horizontal") {
    if (legOffset === undefined || legOffset === null) {
      return { x: source.x + WORKFLOW_CANVAS_HORIZONTAL.stepWidth, y: source.y };
    }
    return { x: source.x + WORKFLOW_CANVAS_HORIZONTAL.branchStepWidth, y: source.y + legOffset };
  }
  if (legOffset === undefined || legOffset === null) {
    return { x: source.x, y: source.y + WORKFLOW_CANVAS_NODE_SPACING.y };
  }
  return { x: source.x + legOffset, y: source.y + WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT };
};

/** Which way a workflow's canvas reads: as it was saved, else top to bottom (every workflow before it). */
export const getCanvasDirection = (definition: TWorkflowDefinition): TWorkflowCanvasDirection =>
  definition.ui?.direction ?? "vertical";
