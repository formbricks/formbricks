// Canvas spacing shared by the layout (definition-to-flow), the editor atoms that place new steps,
// and the If/else card that draws its fork. It imports nothing, so the editor state can use it
// without importing definition-to-flow (which imports the state's types).

/** One layout column (x) and one row (y) between a step and the next. */
export const WORKFLOW_CANVAS_NODE_SPACING = { x: 360, y: 120 };

export const WORKFLOW_CANVAS_START_POSITION = { x: 220, y: 80 };

/**
 * From an If/else card's top to the first step of its branches: the card, its fork with the Then
 * and Else labels, and the edge down to the step.
 */
export const WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT = 200;

/** Horizontal distance between the Then and Else legs of the fork: one column. */
export const WORKFLOW_CANVAS_BRANCH_SPREAD = WORKFLOW_CANVAS_NODE_SPACING.x;

/** Height of the fork drawn under the If/else card, down to where each branch's edge starts. */
export const WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT = 64;

export type TWorkflowCanvasBranch = "then" | "else";

/** Where a step appended after `source` goes: straight below, or below the branch's leg. */
export const getAppendedStepPosition = (
  source: { x: number; y: number },
  branch?: TWorkflowCanvasBranch
): { x: number; y: number } => {
  if (!branch) return { x: source.x, y: source.y + WORKFLOW_CANVAS_NODE_SPACING.y };
  const offset = WORKFLOW_CANVAS_BRANCH_SPREAD / 2;
  return {
    x: source.x + (branch === "then" ? -offset : offset),
    y: source.y + WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT,
  };
};
