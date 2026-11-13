import { describe, expect, test } from "vitest";
import type { TWorkflowRunResource, TWorkflowRunStep } from "@formbricks/workflows";
import { getRunCanvasHighlight, isEdgeOffRunPath } from "./run-canvas-highlight";

const step = (overrides: Partial<TWorkflowRunStep> & Pick<TWorkflowRunStep, "stepId">): TWorkflowRunStep => ({
  stepType: "send_email",
  status: "succeeded",
  error: null,
  startedAt: null,
  finishedAt: null,
  detail: null,
  ...overrides,
});

const ifElse = (stepId: string, branch: "then" | "else" | null) =>
  step({ stepId, stepType: "if_else", detail: { kind: "if_else", branch, conditions: [] } });

const run = (steps: TWorkflowRunStep[]) => ({ steps }) as TWorkflowRunResource;

// trigger → branch; branch.then → email; branch.else → http → after
const edges = {
  intoBranch: { source: "trigger", target: "branch" },
  then: { source: "branch", sourceHandle: "then", target: "email" },
  else: { source: "branch", sourceHandle: "else", target: "http" },
  afterHttp: { source: "http", target: "after" },
};

describe("getRunCanvasHighlight", () => {
  test("is null without a run, so the canvas shows no highlight", () => {
    expect(getRunCanvasHighlight(undefined)).toBeNull();
  });

  test("records the branch each If/else took and the steps it did not reach", () => {
    const highlight = getRunCanvasHighlight(
      run([
        ifElse("branch", "then"),
        step({ stepId: "email" }),
        step({ stepId: "http", status: "not_taken" }),
        step({ stepId: "after", status: "not_taken" }),
      ])
    );

    expect(highlight?.takenBranchByStepId).toEqual({ branch: "then" });
    expect([...(highlight?.notTakenStepIds ?? [])]).toEqual(["http", "after"]);
  });

  test("an If/else that has not decided yet takes no branch", () => {
    expect(getRunCanvasHighlight(run([ifElse("branch", null)]))?.takenBranchByStepId).toEqual({});
  });
});

describe("isEdgeOffRunPath", () => {
  const highlight = getRunCanvasHighlight(
    run([
      ifElse("branch", "then"),
      step({ stepId: "email" }),
      step({ stepId: "http", status: "not_taken" }),
      step({ stepId: "after", status: "not_taken" }),
    ])
  )!;

  test("greys the other branch and every edge inside it; keeps the path the run took", () => {
    expect(isEdgeOffRunPath(edges.intoBranch, highlight)).toBe(false);
    expect(isEdgeOffRunPath(edges.then, highlight)).toBe(false);
    expect(isEdgeOffRunPath(edges.else, highlight)).toBe(true);
    expect(isEdgeOffRunPath(edges.afterHttp, highlight)).toBe(true);
  });

  test("greys nothing for an If/else the run did not decide", () => {
    const undecided = getRunCanvasHighlight(run([ifElse("branch", null)]))!;
    expect(isEdgeOffRunPath(edges.else, undecided)).toBe(false);
  });
});
