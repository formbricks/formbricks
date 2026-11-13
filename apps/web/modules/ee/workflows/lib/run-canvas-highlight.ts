import type { TWorkflowIfElseBranch, TWorkflowRunResource } from "@formbricks/workflows";

/**
 * What the canvas marks while a run is open in the drawer (ENG-7182, mock screen 7): the branch each
 * If/else took, and the steps on the branches it did not take, which the canvas greys.
 */
export interface TRunCanvasHighlight {
  takenBranchByStepId: Record<string, TWorkflowIfElseBranch>;
  notTakenStepIds: Set<string>;
}

export const getRunCanvasHighlight = (
  run: Pick<TWorkflowRunResource, "steps"> | null | undefined
): TRunCanvasHighlight | null => {
  if (!run) return null;
  const takenBranchByStepId: Record<string, TWorkflowIfElseBranch> = {};
  const notTakenStepIds = new Set<string>();
  for (const step of run.steps) {
    if (step.status === "not_taken") notTakenStepIds.add(step.stepId);
    if (step.detail?.kind === "if_else" && step.detail.branch) {
      takenBranchByStepId[step.stepId] = step.detail.branch;
    }
  }
  return { takenBranchByStepId, notTakenStepIds };
};

/** An edge leaving an If/else by the branch it did not take, or leading to a step not taken. */
export const isEdgeOffRunPath = (
  edge: { source: string; target: string; sourceHandle?: string | null },
  highlight: TRunCanvasHighlight
): boolean => {
  if (highlight.notTakenStepIds.has(edge.target)) return true;
  const taken = highlight.takenBranchByStepId[edge.source];
  return taken !== undefined && edge.sourceHandle !== taken;
};
