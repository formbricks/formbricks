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

/** Height of the fork drawn under an If/else or Switch card, down to where each branch's edge starts. */
export const WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT = 64;

/** Which leg of a branching step's fork a branch is: its position and how many legs there are. */
export type TWorkflowCanvasBranchLeg = { index: number; count: number };

/**
 * Where a step appended after `source` goes: straight below, or below its branch's leg. The legs
 * sit one column apart, centered under the step (Then/Else, or a Switch's cases and Default).
 */
export const getAppendedStepPosition = (
  source: { x: number; y: number },
  leg?: TWorkflowCanvasBranchLeg | null
): { x: number; y: number } => {
  if (!leg) return { x: source.x, y: source.y + WORKFLOW_CANVAS_NODE_SPACING.y };
  const offset = (leg.index - (leg.count - 1) / 2) * WORKFLOW_CANVAS_BRANCH_SPREAD;
  return { x: source.x + offset, y: source.y + WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT };
};
