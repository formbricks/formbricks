/**
 * What the workflow view reads out of the tool results. The shapes mirror the v3 workflow resources
 * (`@formbricks/workflows`), narrowed to the fields the view renders. The view package does not depend on
 * that package or on zod, so each reader below checks the few things it needs and drops what does not fit:
 * a malformed run or node never blanks the whole view.
 */

export type WorkflowStatus = "draft" | "enabled" | "disabled" | "archived";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "if_else";
  label?: string;
  triggerType?: string;
  actionType?: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface WorkflowDefinition {
  trigger: WorkflowNode | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowInfo {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  runCount: number;
  definition: WorkflowDefinition;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  isDryRun: boolean;
  surveyId: string | null;
  responseId: string | null;
  error: string | null;
  attempt: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunStepLog {
  id: string;
  sequence: number;
  stepId: string;
  stepType: string;
  status: StepStatus;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface RunDetail extends RunSummary {
  endingCardId: string | null;
  /** How many answers the trigger carried. Their content stays out of the view. */
  responseFieldCount: number;
  logs: RunStepLog[];
}

export interface WorkflowViewData {
  workflow: WorkflowInfo;
  recentRuns: RunSummary[];
  recentRunsError: string | null;
}

const WORKFLOW_STATUSES: readonly string[] = ["draft", "enabled", "disabled", "archived"];
const RUN_STATUSES: readonly string[] = ["queued", "running", "completed", "failed", "canceled"];
const STEP_STATUSES: readonly string[] = ["pending", "running", "succeeded", "failed", "skipped"];
const NODE_TYPES: readonly string[] = ["trigger", "action", "if_else"];

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const asStringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

const readNode = (value: unknown): WorkflowNode | null => {
  if (!isRecord(value)) return null;
  const { id, type } = value;
  if (typeof id !== "string" || typeof type !== "string" || !NODE_TYPES.includes(type)) return null;
  return {
    id,
    type: type as WorkflowNode["type"],
    label: asString(value.label),
    triggerType: asString(value.triggerType),
    actionType: asString(value.actionType),
    config: isRecord(value.config) ? value.config : {},
  };
};

const readEdge = (value: unknown): WorkflowEdge | null => {
  if (!isRecord(value)) return null;
  const { source, target } = value;
  if (typeof source !== "string" || typeof target !== "string") return null;
  return { source, target, sourceHandle: asString(value.sourceHandle) };
};

const readDefinition = (value: unknown): WorkflowDefinition => {
  const source = isRecord(value) ? value : {};
  return {
    trigger: readNode(source.trigger),
    nodes: (Array.isArray(source.nodes) ? source.nodes : []).flatMap((node) => readNode(node) ?? []),
    edges: (Array.isArray(source.edges) ? source.edges : []).flatMap((edge) => readEdge(edge) ?? []),
  };
};

export const readRunSummary = (value: unknown): RunSummary | null => {
  if (!isRecord(value)) return null;
  const { id, status, createdAt } = value;
  if (typeof id !== "string" || typeof createdAt !== "string") return null;
  if (typeof status !== "string" || !RUN_STATUSES.includes(status)) return null;
  return {
    id,
    status: status as RunStatus,
    isDryRun: value.isDryRun === true,
    surveyId: asStringOrNull(value.surveyId),
    responseId: asStringOrNull(value.responseId),
    error: asStringOrNull(value.error),
    attempt: typeof value.attempt === "number" ? value.attempt : 0,
    createdAt,
    startedAt: asStringOrNull(value.startedAt),
    finishedAt: asStringOrNull(value.finishedAt),
  };
};

export const readRunList = (value: unknown): RunSummary[] =>
  (Array.isArray(value) ? value : []).flatMap((run) => readRunSummary(run) ?? []);

const readStepLog = (value: unknown): RunStepLog | null => {
  if (!isRecord(value)) return null;
  const { id, stepId, stepType, status } = value;
  if (typeof id !== "string" || typeof stepId !== "string" || typeof stepType !== "string") return null;
  if (typeof status !== "string" || !STEP_STATUSES.includes(status)) return null;
  return {
    id,
    sequence: typeof value.sequence === "number" ? value.sequence : 0,
    stepId,
    stepType,
    status: status as StepStatus,
    error: asStringOrNull(value.error),
    startedAt: asStringOrNull(value.startedAt),
    finishedAt: asStringOrNull(value.finishedAt),
    input: isRecord(value.input) ? value.input : {},
    output: isRecord(value.output) ? value.output : {},
  };
};

/** `structuredContent` of `show_workflow`, or `undefined` when it is not a workflow. */
export const readWorkflowView = (structured: unknown): WorkflowViewData | undefined => {
  if (!isRecord(structured) || !isRecord(structured.workflow)) return undefined;
  const source = structured.workflow;
  const { id, workspaceId, name, status } = source;
  if (typeof id !== "string" || typeof workspaceId !== "string" || typeof name !== "string") return undefined;
  if (typeof status !== "string" || !WORKFLOW_STATUSES.includes(status)) return undefined;

  return {
    workflow: {
      id,
      workspaceId,
      name,
      description: asStringOrNull(source.description),
      status: status as WorkflowStatus,
      runCount: typeof source.runCount === "number" ? source.runCount : 0,
      definition: readDefinition(source.definition),
    },
    recentRuns: readRunList(structured.recentRuns),
    recentRunsError: asStringOrNull(structured.recentRunsError),
  };
};

/** `structuredContent` of `list_workflow_runs`: `{ data: [...] }`. */
export const readRunsPage = (structured: unknown): RunSummary[] | undefined =>
  isRecord(structured) && Array.isArray(structured.data) ? readRunList(structured.data) : undefined;

/** `structuredContent` of `get_workflow_run`: `{ data: run }`, with its step logs in order. */
export const readRunDetail = (structured: unknown): RunDetail | undefined => {
  if (!isRecord(structured) || !isRecord(structured.data)) return undefined;
  const source = structured.data;
  const summary = readRunSummary(source);
  if (!summary) return undefined;

  const payload = isRecord(source.triggerPayload) ? source.triggerPayload : {};
  const logs = (Array.isArray(source.logs) ? source.logs : [])
    .flatMap((log) => readStepLog(log) ?? [])
    .sort((a, b) => a.sequence - b.sequence);

  return {
    ...summary,
    endingCardId: asStringOrNull(payload.endingCardId),
    responseFieldCount: isRecord(payload.data) ? Object.keys(payload.data).length : 0,
    logs,
  };
};
