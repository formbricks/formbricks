import { describe, expect, test } from "vitest";
import {
  type TWorkflowRunResource,
  WORKFLOW_API_OPERATIONS,
  ZCreateWorkflowInput,
  ZListWorkflowRunsInput,
  ZListWorkflowsInput,
  ZPatchWorkflowInput,
  ZTestWorkflowInput,
  ZWorkflowListItem,
  ZWorkflowResource,
  ZWorkflowRunLogResource,
  ZWorkflowRunResource,
  ZWorkflowRunSummary,
} from ".";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const runId = "cm9zr4w9d000308l8c5n8xk7e";
const responseId = "cm9zr4z1f000408l8a9p2mv5g";
const userId = "cm9zr52kh000508l8e3q7bw9j";

const definition = {
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
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

const runSummary = {
  id: runId,
  workflowId,
  workspaceId,
  workflowVersionId: null,
  status: "queued",
  isDryRun: true,
  triggerType: "response.completed",
  surveyId,
  responseId: null,
  error: null,
  attempt: 0,
  createdAt: "2026-06-11T09:30:00.000Z",
  updatedAt: "2026-06-11T09:30:00.000Z",
  startedAt: null,
  finishedAt: null,
};

const runResource: TWorkflowRunResource = {
  ...ZWorkflowRunSummary.parse(runSummary),
  triggerPayload: {
    type: "response.completed",
    workspaceId,
    surveyId,
    responseId,
    triggeredAt: "2026-06-11T09:30:00.000Z",
  },
  data: { steps: [] },
  logs: [],
  idempotencyKey: null,
  nextAttemptAt: null,
  lastErrorAt: null,
};

describe("workflow operation inputs", () => {
  test("accepts a minimal create input and rejects unknown status", () => {
    expect(() => ZCreateWorkflowInput.parse({ workspaceId, name: "Notify team", definition })).not.toThrow();
    expect(
      ZCreateWorkflowInput.safeParse({ workspaceId, name: "x", definition, status: "enabled" }).success
    ).toBe(false);
  });

  test("accepts a trigger-only draft definition on create", () => {
    const triggerOnly = { ...definition, nodes: [], edges: [] };
    expect(() =>
      ZCreateWorkflowInput.parse({ workspaceId, name: "Draft", definition: triggerOnly })
    ).not.toThrow();
  });

  test("rejects an empty patch", () => {
    expect(ZPatchWorkflowInput.safeParse({}).success).toBe(false);
    expect(ZPatchWorkflowInput.safeParse({ name: "Renamed" }).success).toBe(true);
  });

  test("list inputs apply defaults and bounds", () => {
    const parsed = ZListWorkflowsInput.parse({ workspaceId });
    expect(parsed.limit).toBe(20);
    expect(parsed.sortBy).toBe("updatedAt");
    expect(ZListWorkflowsInput.safeParse({ workspaceId, limit: 101 }).success).toBe(false);
    expect(ZListWorkflowRunsInput.safeParse({ workspaceId, statusIn: [] }).success).toBe(false);
  });

  test("test input accepts replay and idempotency key", () => {
    expect(() => ZTestWorkflowInput.parse({})).not.toThrow();
    expect(() => ZTestWorkflowInput.parse({ responseId, idempotencyKey: "retry-1" })).not.toThrow();
    expect(ZTestWorkflowInput.safeParse({ idempotencyKey: "" }).success).toBe(false);
  });

  test("inputs reject unknown fields instead of stripping them", () => {
    expect(
      ZCreateWorkflowInput.safeParse({ workspaceId, name: "Notify team", definition, unknownField: true })
        .success
    ).toBe(false);
    expect(ZTestWorkflowInput.safeParse({ triggerPayload: {} }).success).toBe(false);
    expect(ZPatchWorkflowInput.safeParse({ name: "Renamed", status: "enabled" }).success).toBe(false);
  });
});

describe("workflow resources", () => {
  const listItem = {
    id: workflowId,
    workspaceId,
    name: "Notify team",
    description: null,
    status: "draft",
    triggerType: "response.completed",
    surveyId,
    createdBy: userId,
    creator: { name: "Ada Lovelace" },
    createdAt: "2026-06-11T09:30:00.000Z",
    updatedAt: "2026-06-11T09:30:00.000Z",
    lastRun: null,
  };

  test("parses a workflow list item and full resource", () => {
    expect(() => ZWorkflowListItem.parse(listItem)).not.toThrow();
    expect(() => ZWorkflowResource.parse({ ...listItem, definition })).not.toThrow();
  });

  test("list item embeds a run summary as lastRun", () => {
    expect(() => ZWorkflowListItem.parse({ ...listItem, lastRun: runSummary })).not.toThrow();
  });

  test("parses a queued dry-run resource with empty logs", () => {
    expect(() => ZWorkflowRunResource.parse(runResource)).not.toThrow();
  });

  test("run resource requires explicit nullable fields", () => {
    const { idempotencyKey: _omitted, ...withoutKey } = runResource;
    expect(ZWorkflowRunResource.safeParse(withoutKey).success).toBe(false);
  });

  test("log resource entries emit every field explicitly", () => {
    const logEntry = {
      id: "cm9zr55mj000608l8g7r4cz2k",
      runId,
      sequence: 0,
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      input: {},
      output: { mocked: true },
      error: null,
      startedAt: "2026-06-11T09:30:01.000Z",
      finishedAt: "2026-06-11T09:30:02.000Z",
    };
    expect(() => ZWorkflowRunLogResource.parse(logEntry)).not.toThrow();
    expect(() => ZWorkflowRunResource.parse({ ...runResource, logs: [logEntry] })).not.toThrow();

    const { error: _omittedError, ...withoutError } = logEntry;
    expect(ZWorkflowRunLogResource.safeParse(withoutError).success).toBe(false);
  });
});

describe("operations map", () => {
  test("every operation defines an output or is the delete operation", () => {
    for (const [operationId, operation] of Object.entries(WORKFLOW_API_OPERATIONS)) {
      if (operationId === "deleteWorkflowV3") {
        expect(operation.output).toBeNull();
      } else {
        expect(operation.output).not.toBeNull();
      }
    }
  });

  test("detail operations carry params and list operations carry inputs", () => {
    expect(WORKFLOW_API_OPERATIONS.getWorkflowV3.params).not.toBeNull();
    expect(WORKFLOW_API_OPERATIONS.getWorkflowRunV3.params).not.toBeNull();
    expect(WORKFLOW_API_OPERATIONS.listWorkflowsV3.input).not.toBeNull();
    expect(WORKFLOW_API_OPERATIONS.listWorkflowRunsV3.input).not.toBeNull();
  });
});
