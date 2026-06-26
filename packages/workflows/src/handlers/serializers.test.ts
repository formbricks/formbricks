import { describe, expect, test } from "vitest";
import type {
  WorkflowRowWithLastRun,
  WorkflowRunListRow,
  WorkflowRunLogRow,
  WorkflowRunRow,
  WorkflowRunWithLogsRow,
} from "../services/ports";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import {
  toWorkflowListItem,
  toWorkflowResource,
  toWorkflowRunListItem,
  toWorkflowRunLogResource,
  toWorkflowRunResource,
  toWorkflowRunSummary,
} from "./serializers";

const surveyId = "cm9zr4q7i000108l84gozfggr";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const workspaceId = "cm9zr4mps000008l8btfy1vtz";

const definition = {
  schemaVersion: 1 as const,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action" as const,
      actionType: "send_email" as const,
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks",
        body: "Thanks for your response.",
        attachResponseData: true,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

const run: WorkflowRunRow = {
  id: "cm9zr4w9d000308l8c5n8xk7e",
  createdAt: new Date("2026-06-12T10:00:00.000Z"),
  updatedAt: new Date("2026-06-12T10:01:00.000Z"),
  workflowId,
  workspaceId,
  workflowVersionId: null,
  responseId: null,
  status: "completed",
  triggerType: "response.completed",
  surveyId,
  isDryRun: true,
  attempt: 0,
  error: null,
  startedAt: new Date("2026-06-12T10:00:30.000Z"),
  finishedAt: new Date("2026-06-12T10:01:00.000Z"),
};

const baseRow: WorkflowRowWithLastRun = {
  id: workflowId,
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  name: "Notify team",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: "cm9zr52kh000508l8e3q7bw9j",
  creator: { name: "Ada Lovelace" },
  definition,
  runs: [],
};

describe("serializers", () => {
  test("derives triggerType and surveyId from the definition and emits ISO dates", () => {
    const item = toWorkflowListItem(baseRow);
    expect(item.triggerType).toBe("response.completed");
    expect(item.surveyId).toBe(surveyId);
    expect(item.createdAt).toBe("2026-06-11T09:30:00.000Z");
    expect(item.lastRun).toBeNull();
  });

  test("maps the creator name through and emits null when the creator was deleted", () => {
    expect(toWorkflowListItem(baseRow).creator).toEqual({ name: "Ada Lovelace" });
    expect(toWorkflowListItem({ ...baseRow, creator: null }).creator).toBeNull();
    expect(toWorkflowListItem({ ...baseRow, creator: undefined }).creator).toBeNull();
  });

  test("embeds the most recent run as lastRun", () => {
    const item = toWorkflowListItem({ ...baseRow, runs: [run] });
    expect(item.lastRun?.id).toBe(run.id);
    expect(item.lastRun?.startedAt).toBe("2026-06-12T10:00:30.000Z");
  });

  test("run summary maps nullable timestamps explicitly", () => {
    const summary = toWorkflowRunSummary({ ...run, startedAt: null, finishedAt: null });
    expect(summary.startedAt).toBeNull();
    expect(summary.finishedAt).toBeNull();
  });

  test("run list item spreads the summary and joins the workflow name", () => {
    const listRow: WorkflowRunListRow = { ...run, workflow: { name: "Notify team" } };
    const item = toWorkflowRunListItem(listRow);
    expect(item.id).toBe(run.id);
    expect(item.workflowName).toBe("Notify team");
    // Inherits the summary projection.
    expect(item.startedAt).toBe("2026-06-12T10:00:30.000Z");
  });

  test("the full resource includes the definition", () => {
    const resource = toWorkflowResource(baseRow);
    expect(resource.definition).toEqual(definition);
    expect(resource.id).toBe(workflowId);
  });
});

const triggerPayload = {
  triggerType: "response.completed",
  config: { surveyId, endingCardIds: [] },
  surveyId,
  responseId: "cm9zr5resp0000000000000000",
  finishedEndingId: null,
  triggeredAt: "2026-06-12T10:00:00.000Z",
} as unknown as TWorkflowTriggerRunPayload;

const logA: WorkflowRunLogRow = {
  id: "cm9zr5log0000000000000000a",
  runId: run.id,
  sequence: 0,
  stepId: "send-email",
  stepType: "send_email",
  status: "succeeded",
  input: { to: "support@example.com" },
  output: { messageId: "msg_1" },
  error: null,
  startedAt: new Date("2026-06-12T10:00:30.000Z"),
  finishedAt: new Date("2026-06-12T10:00:31.000Z"),
};

const detailRun: WorkflowRunWithLogsRow = {
  ...run,
  triggerPayload,
  data: { steps: [] },
  idempotencyKey: "idem-1",
  nextAttemptAt: null,
  lastErrorAt: null,
  logs: [logA],
};

describe("run serializers", () => {
  test("run log resource emits every field explicitly, including null error/timestamps", () => {
    const resource = toWorkflowRunLogResource({
      ...logA,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    expect(resource).toEqual({
      id: logA.id,
      runId: run.id,
      sequence: 0,
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      input: { to: "support@example.com" },
      output: { messageId: "msg_1" },
      error: null,
      startedAt: null,
      finishedAt: null,
    });
  });

  test("run resource carries summary fields, triggerPayload, data, and serialized logs", () => {
    const resource = toWorkflowRunResource(detailRun);

    expect(resource.id).toBe(run.id);
    expect(resource.status).toBe("completed");
    expect(resource.triggerPayload).toEqual(triggerPayload);
    expect(resource.data).toEqual({ steps: [] });
    expect(resource.idempotencyKey).toBe("idem-1");
    expect(resource.nextAttemptAt).toBeNull();
    expect(resource.lastErrorAt).toBeNull();
    expect(resource.logs).toHaveLength(1);
    expect(resource.logs[0]).toMatchObject({ id: logA.id, sequence: 0, status: "succeeded" });
    expect(resource.logs[0].startedAt).toBe("2026-06-12T10:00:30.000Z");
  });

  test("serializes non-null nextAttemptAt / lastErrorAt as ISO strings", () => {
    const resource = toWorkflowRunResource({
      ...detailRun,
      nextAttemptAt: new Date("2026-06-12T11:00:00.000Z"),
      lastErrorAt: new Date("2026-06-12T10:30:00.000Z"),
    });

    expect(resource.nextAttemptAt).toBe("2026-06-12T11:00:00.000Z");
    expect(resource.lastErrorAt).toBe("2026-06-12T10:30:00.000Z");
  });
});
