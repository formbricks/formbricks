import type {
  TWorkflowRunContext,
  TWorkflowStepNodeOfType,
  TWorkflowStepResult,
  TWorkflowStepType,
  TWorkflowWalkDecision,
} from "@formbricks/workflows";
import type { WorkflowRunEffects } from "../effects";
import type { WorkflowRunEnvironment } from "../run-environment";

/** What running a step produced; recorded on its `WorkflowRunLog` row and in `data.steps`. */
export interface WorkflowStepOutcome {
  status: TWorkflowStepResult["status"];
  error: string | null;
  /** Recorded on the step's log row; kept under the step's id in the run context unless `variables` is set. */
  output: Record<string, unknown>;
  /**
   * What later steps read as `steps.<id>.…` when it differs from what the log keeps: an HTTP response
   * up to 1 MB lives here, in memory only, while the log keeps at most 64 KB of it (ENG-7168).
   */
  variables?: Record<string, unknown>;
  /**
   * `false` for a failure another attempt can't fix (an invalid address, a spent per-workflow cap):
   * the run fails at once instead of being retried. Failures are retryable by default.
   */
  retryable?: boolean;
}

export interface WorkflowStepExecution<T extends TWorkflowStepType> {
  node: TWorkflowStepNodeOfType<T>;
  /** Variables available to this step: the trigger's sources and every earlier step's output. */
  context: TWorkflowRunContext;
  environment: WorkflowRunEnvironment;
  effects: WorkflowRunEffects;
}

/**
 * Runs one step type. The runner owns the walk, the per-step claim and persistence; an executor
 * only turns a node and the run so far into an outcome. Register new step types in
 * `WORKFLOW_STEP_EXECUTORS` (`./index.ts`), one file each (ENG-7179 `http_request`).
 */
export interface WorkflowStepExecutor<T extends TWorkflowStepType> {
  /**
   * `true` when the step acts outside the run (sends, calls). Such a step runs at most once per run:
   * a step found `running` after a crash is never re-run. A step without effects (If/else) is safe
   * to run again, so a `running` row is simply re-evaluated.
   */
  hasEffects: boolean;
  /** What the step was asked to do, recorded on its log row before it runs. Never secrets. */
  describeInput: (node: TWorkflowStepNodeOfType<T>) => Record<string, unknown>;
  execute: (execution: WorkflowStepExecution<T>) => Promise<WorkflowStepOutcome>;
  /**
   * Where the walk goes after a succeeded step, read from its output so a resumed step (output
   * from the log) takes the same way it did the first time. Defaults to `continue`.
   */
  decide?: (output: Record<string, unknown>) => TWorkflowWalkDecision;
  /**
   * The Variables of a step resumed from its log row (a run retried after a crash). Defaults to the
   * stored output.
   */
  variablesFromOutput?: (output: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Whether this step handed its effect to a background job ("Don't wait" HTTP request). From then on
   * the job owns the step's row: the runner never runs it again, and its outcome never fails the run.
   */
  handedOff?: (output: Record<string, unknown>) => boolean;
}
