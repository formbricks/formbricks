import {
  type TWorkflowCondition,
  type TWorkflowDefinition,
  type TWorkflowIfElseBranch,
  type TWorkflowRunResource,
  type TWorkflowRunStep,
  type TWorkflowRunStepDetail,
  type TWorkflowSwitchNode,
  type TWorkflowTriggerType,
  WORKFLOW_SWITCH_DEFAULT_BRANCH,
  flattenWorkflowConditions,
} from "@formbricks/workflows";
import { formatStepDuration } from "@/modules/ee/workflows/lib/run-display";

/**
 * Run detail as rows (ENG-7182, mock screens 7–9): the trigger first, then each step the run walked,
 * then the steps on If/else and Switch branches it did not take. Pure, so the drawer only renders: every
 * decision (which badge, which branch a step sits on, which condition a result belongs to, how a
 * request reads) lives here.
 *
 * The definition supplies what the run does not record: step labels, condition texts, case names
 * and the branch a step not taken sits on. It is the workflow's current one, so a run of an older version
 * may name a condition that is gone; that condition keeps its result without a text.
 */

/** What the badge on a row says. A Test run makes no outside calls, so its sends read "would send". */
export type TRunDetailBadge =
  | TWorkflowRunStep["status"]
  | "would_send"
  | "sending"
  | "sent"
  | "delivery_failed";

interface TRunDetailStepRowBase {
  /** 1-based, the trigger being 1. */
  position: number;
  stepId: string;
  stepType: string;
  /** The step's own label from the definition, or null to fall back to its type's name. */
  label: string | null;
  badge: TRunDetailBadge;
  duration: string | null;
  error: string | null;
}

export interface TRunDetailTriggerRow {
  kind: "trigger";
  position: 1;
  stepId: null;
  triggerType: TWorkflowTriggerType;
  /** The Webhook payload the run started with; null for a response-completed run. */
  payload: Record<string, unknown> | null;
}

export interface TRunDetailConditionResult {
  id: string;
  matched: boolean;
  /** The condition as the definition has it, or null when it is no longer there. */
  condition: TWorkflowCondition | null;
}

export interface TRunDetailIfElseRow extends TRunDetailStepRowBase {
  kind: "if_else";
  branch: TWorkflowIfElseBranch | null;
  conditions: TRunDetailConditionResult[];
}

/**
 * A Switch branch as run detail names it: Default, or a case by its name. A case without a name reads
 * by its 1-based number; `number` is null for a case the definition no longer has.
 */
export type TRunDetailSwitchBranch =
  | { isDefault: true }
  | { isDefault: false; name: string | null; number: number | null };

export interface TRunDetailSwitchCaseResult {
  id: string;
  matched: boolean;
  name: string | null;
  number: number | null;
}

export interface TRunDetailSwitchRow extends TRunDetailStepRowBase {
  kind: "switch";
  /** The branch the run took, null until decided. */
  taken: TRunDetailSwitchBranch | null;
  /** The cases tried, in order, up to the one that matched. */
  cases: TRunDetailSwitchCaseResult[];
}

export interface TRunDetailSendEmailRow extends TRunDetailStepRowBase {
  kind: "send_email";
  recipient: string | null;
  subject: string | null;
  surveyLink: string | null;
}

export interface TRunDetailHttpRequestRow extends TRunDetailStepRowBase {
  kind: "http_request";
  /** Method and URL, the headers (secret values already masked by the server), then the body. */
  requestText: string | null;
  requestBodyTruncated: boolean;
  response: { status: number; bodyText: string; bodyTruncated: boolean } | null;
  testSample: "used" | "missing" | null;
  /** Why no answer came, when Continue on error let the run go on. */
  httpError: string | null;
}

export interface TRunDetailNotTakenRow extends TRunDetailStepRowBase {
  kind: "not_taken";
  /** The If/else branch the step sits on, or null when it sits on a Switch branch or the definition doesn't say. */
  branch: TWorkflowIfElseBranch | null;
  /** The Switch branch the step sits on, or null when it sits on an If/else branch or the definition doesn't say. */
  switchBranch: TRunDetailSwitchBranch | null;
}

export interface TRunDetailOtherRow extends TRunDetailStepRowBase {
  kind: "other";
}

export type TRunDetailStepRow =
  | TRunDetailIfElseRow
  | TRunDetailSwitchRow
  | TRunDetailSendEmailRow
  | TRunDetailHttpRequestRow
  | TRunDetailNotTakenRow
  | TRunDetailOtherRow;

export type TRunDetailRow = TRunDetailTriggerRow | TRunDetailStepRow;

type THttpDetail = Extract<TWorkflowRunStepDetail, { kind: "http_request" }>;

const DELIVERY_BADGES: Record<NonNullable<THttpDetail["delivery"]>, TRunDetailBadge> = {
  sending: "sending",
  sent: "sent",
  failed: "delivery_failed",
};

const SENDING_STEP_TYPES = new Set(["send_email", "http_request"]);

const getBadge = (step: TWorkflowRunStep, isDryRun: boolean): TRunDetailBadge => {
  const { detail } = step;
  // A Don't wait request finishes its step at once; what the reader wants is whether it arrived.
  if (detail?.kind === "http_request" && detail.mode === "dont_wait" && detail.delivery) {
    return DELIVERY_BADGES[detail.delivery];
  }
  if (isDryRun && step.status === "succeeded" && SENDING_STEP_TYPES.has(step.stepType)) {
    return "would_send";
  }
  return step.status;
};

const formatRequest = (request: NonNullable<THttpDetail["request"]>): string => {
  const head = [`${request.method} ${request.url}`, ...request.headers.map((h) => `${h.name}: ${h.value}`)];
  return request.body === undefined || request.body === ""
    ? head.join("\n")
    : `${head.join("\n")}\n\n${request.body}`;
};

const formatResponseBody = (body: unknown): string => {
  if (typeof body === "string") return body;
  if (body === undefined || body === null) return "";
  return JSON.stringify(body, null, 2);
};

const describeSwitchBranch = (node: TWorkflowSwitchNode, handle: string): TRunDetailSwitchBranch => {
  if (handle === WORKFLOW_SWITCH_DEFAULT_BRANCH) return { isDefault: true };
  const index = node.config.cases.findIndex((switchCase) => switchCase.id === handle);
  if (index === -1) return { isDefault: false, name: null, number: null };
  return { isDefault: false, name: node.config.cases[index].name.trim() || null, number: index + 1 };
};

/** The branch a step sits on: the handle of the nearest If/else or Switch edge above it. */
const findBranchOfStep = (
  definition: TWorkflowDefinition,
  stepId: string
): Pick<TRunDetailNotTakenRow, "branch" | "switchBranch"> => {
  const none = { branch: null, switchBranch: null };
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let current = stepId;
  while (!visited.has(current)) {
    visited.add(current);
    const incoming = definition.edges.find((edge) => edge.target === current);
    if (!incoming) return none;
    const source = nodesById.get(incoming.source);
    if (source?.type === "if_else") {
      const isIfElseBranch = incoming.sourceHandle === "then" || incoming.sourceHandle === "else";
      return {
        branch: isIfElseBranch ? (incoming.sourceHandle as TWorkflowIfElseBranch) : null,
        switchBranch: null,
      };
    }
    if (source?.type === "switch") {
      return { branch: null, switchBranch: describeSwitchBranch(source, incoming.sourceHandle ?? "") };
    }
    current = incoming.source;
  }
  return none;
};

const findSwitchOf = (definition: TWorkflowDefinition | null, stepId: string): TWorkflowSwitchNode | null => {
  const node = definition?.nodes.find((n) => n.id === stepId);
  return node?.type === "switch" ? node : null;
};

const findConditionsOf = (
  definition: TWorkflowDefinition | null,
  stepId: string
): Map<string, TWorkflowCondition> => {
  const node = definition?.nodes.find((n) => n.id === stepId);
  if (node?.type !== "if_else") return new Map();
  return new Map(flattenWorkflowConditions(node.config.condition).map((c) => [c.id, c]));
};

const toStepRow = (
  step: TWorkflowRunStep,
  position: number,
  run: TWorkflowRunResource,
  definition: TWorkflowDefinition | null
): TRunDetailStepRow => {
  const base: TRunDetailStepRowBase = {
    position,
    stepId: step.stepId,
    stepType: step.stepType,
    label: definition?.nodes.find((node) => node.id === step.stepId)?.label ?? null,
    badge: getBadge(step, run.isDryRun),
    duration: formatStepDuration(step.startedAt, step.finishedAt),
    error: step.error,
  };

  if (step.status === "not_taken") {
    return {
      ...base,
      kind: "not_taken",
      ...(definition ? findBranchOfStep(definition, step.stepId) : { branch: null, switchBranch: null }),
    };
  }

  const { detail } = step;
  switch (detail?.kind) {
    case "if_else": {
      const conditions = findConditionsOf(definition, step.stepId);
      return {
        ...base,
        kind: "if_else",
        branch: detail.branch,
        conditions: detail.conditions.map(({ id, matched }) => ({
          id,
          matched,
          condition: conditions.get(id) ?? null,
        })),
      };
    }
    case "switch": {
      const node = findSwitchOf(definition, step.stepId);
      return {
        ...base,
        kind: "switch",
        taken: node && detail.branch ? describeSwitchBranch(node, detail.branch) : null,
        cases: detail.cases.map(({ id, matched }) => {
          const named = node ? describeSwitchBranch(node, id) : null;
          return {
            id,
            matched,
            name: named && !named.isDefault ? named.name : null,
            number: named && !named.isDefault ? named.number : null,
          };
        }),
      };
    }
    case "send_email":
      return {
        ...base,
        kind: "send_email",
        recipient: detail.recipient,
        subject: detail.subject,
        surveyLink: detail.surveyLink,
      };
    case "http_request":
      return {
        ...base,
        kind: "http_request",
        requestText: detail.request ? formatRequest(detail.request) : null,
        requestBodyTruncated: detail.request?.bodyTruncated ?? false,
        response: detail.response
          ? {
              status: detail.response.status,
              bodyText: formatResponseBody(detail.response.body),
              bodyTruncated: detail.response.bodyTruncated ?? false,
            }
          : null,
        testSample: detail.testSample,
        httpError: detail.error,
      };
    default:
      // An If/else or Switch whose log has no readable detail (still running, or an older runner) is
      // still its own row, with no branch yet.
      if (step.stepType === "if_else") return { ...base, kind: "if_else", branch: null, conditions: [] };
      if (step.stepType === "switch") return { ...base, kind: "switch", taken: null, cases: [] };
      return { ...base, kind: "other" };
  }
};

/**
 * The retention period after which a run's details were deleted (ADR 0044), for "Details deleted after
 * N days"; null while they are kept.
 */
export const getRunContentDeletedDays = (run: TWorkflowRunResource): number | null =>
  run.contentDeletedAt ? run.contentRetentionDays : null;

export const toRunDetailRows = (
  run: TWorkflowRunResource,
  definition: TWorkflowDefinition | null
): TRunDetailRow[] => {
  const contentDeleted = Boolean(run.contentDeletedAt);
  const trigger: TRunDetailTriggerRow = {
    kind: "trigger",
    position: 1,
    stepId: null,
    triggerType: run.triggerType,
    payload: !contentDeleted && run.triggerPayload.type === "webhook" ? run.triggerPayload.payload : null,
  };
  // A run whose details were deleted shows the notice instead of its steps.
  if (contentDeleted) return [trigger];
  return [trigger, ...run.steps.map((step, index) => toStepRow(step, index + 2, run, definition))];
};
