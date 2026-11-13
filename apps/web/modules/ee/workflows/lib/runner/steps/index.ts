import type { TWorkflowStepNode, TWorkflowStepType } from "@formbricks/workflows";
import { getWorkflowStepType } from "@formbricks/workflows";
import { httpRequestStepExecutor } from "./http-request";
import { ifElseStepExecutor } from "./if-else";
import { sendEmailStepExecutor } from "./send-email";
import { switchStepExecutor } from "./switch";
import type { WorkflowStepExecutor } from "./types";

/**
 * The step-executor registry: one executor per step type. Keyed by `TWorkflowStepType`, so a new
 * action type in the definition schema fails to compile until its executor is registered here.
 */
export const WORKFLOW_STEP_EXECUTORS: { [T in TWorkflowStepType]: WorkflowStepExecutor<T> } = {
  send_email: sendEmailStepExecutor,
  http_request: httpRequestStepExecutor,
  if_else: ifElseStepExecutor,
  switch: switchStepExecutor,
};

/** The executor for a node, typed loosely for the runner's generic step loop. */
export const getWorkflowStepExecutor = (node: TWorkflowStepNode): WorkflowStepExecutor<TWorkflowStepType> =>
  WORKFLOW_STEP_EXECUTORS[getWorkflowStepType(node)] as unknown as WorkflowStepExecutor<TWorkflowStepType>;
