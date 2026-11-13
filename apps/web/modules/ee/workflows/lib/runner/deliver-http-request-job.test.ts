import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowHttpRequestDeliveryJobData } from "@formbricks/jobs";
import type { WorkflowHttpCallResult } from "../http-request/send-http-request";
import { createWorkflowHttpRequestDeliveryJobHandler } from "./deliver-http-request-job";

const { runFindFirst, logFindFirst, logUpdateMany, loadSecrets } = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  logFindFirst: vi.fn(),
  logUpdateMany: vi.fn(),
  loadSecrets: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: { findFirst: runFindFirst },
    workflowRunLog: { findFirst: logFindFirst, updateMany: logUpdateMany },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/ee/workflows/lib/secrets/workflow-secret-store", () => ({
  loadWorkflowSecretValues: loadSecrets,
}));

const SECRET = "Bearer sk_live_job";

const data: TWorkflowHttpRequestDeliveryJobData = {
  workflowRunId: "cm9zr4run000908l8q9b9d3pm",
  workflowId: "cm9zr4wfl000008l8q9b9d3pm",
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
  stepId: "call",
};
const jobContext = {
  attempt: 1,
  jobId: "j",
  jobName: "workflow-http-request.deliver",
  maxAttempts: 1,
  queueName: "q",
};

const definition = {
  nodes: [
    {
      id: "call",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://api.example.com/hook",
        queryParameters: [],
        headers: [
          { name: "Authorization", secret: true, secretId: "sec_1" },
          { name: "X-Team", value: "growth" },
        ],
        body: "{}",
        responseMode: "dont_wait",
        continueOnError: false,
      },
    },
  ],
};

const sendingRow = {
  status: "running",
  output: {
    mode: "dont_wait",
    delivery: "sending",
    request: {
      method: "POST",
      url: "https://api.example.com/hook?id=7",
      headers: [
        { name: "Authorization", value: "••••••" },
        { name: "X-Team", value: "growth" },
        { name: "content-type", value: "application/json" },
      ],
      body: '{"id":7}',
    },
  },
};

const send = vi.fn<(call: unknown) => Promise<WorkflowHttpCallResult>>();
const handler = createWorkflowHttpRequestDeliveryJobHandler({ send });

/** The terminal write the job made to the step's log row. */
const finalWrite = () =>
  logUpdateMany.mock.calls.at(-1)?.[0] as { where: unknown; data: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();
  runFindFirst.mockResolvedValue({
    workflowId: data.workflowId,
    workflowVersion: { definition },
    workflow: { definition },
  });
  logFindFirst.mockResolvedValue(sendingRow);
  logUpdateMany.mockResolvedValue({ count: 1 });
  loadSecrets.mockResolvedValue(new Map([["sec_1", SECRET]]));
  send.mockResolvedValue({
    response: { status: 202, contentType: "application/json", bodyText: '{"ok":true}', truncated: false },
    error: null,
    attempts: 1,
  });
});

describe("workflow HTTP request delivery job", () => {
  test("sends the stored request with the secret decrypted, then marks the step sent", async () => {
    await handler(data, jobContext);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      url: "https://api.example.com/hook?id=7",
      headers: { Authorization: SECRET, "X-Team": "growth", "content-type": "application/json" },
      body: '{"id":7}',
    });
    expect(loadSecrets).toHaveBeenCalledWith({
      workflowId: data.workflowId,
      workspaceId: data.workspaceId,
      secretIds: ["sec_1"],
    });
    const write = finalWrite();
    expect(write.where).toEqual({ runId: data.workflowRunId, stepId: "call", status: "running" });
    expect(write.data).toMatchObject({
      status: "succeeded",
      error: null,
      output: { mode: "dont_wait", delivery: "sent", status: 202, body: { ok: true } },
    });
    expect(JSON.stringify(logUpdateMany.mock.calls)).not.toContain(SECRET);
  });

  test("a final failure shows on the step (the run is left alone)", async () => {
    send.mockResolvedValue({ response: null, error: "The request timed out after 10 s", attempts: 4 });

    await handler(data, jobContext);

    expect(finalWrite().data).toMatchObject({
      status: "failed",
      error: "The request timed out after 10 s",
      output: { delivery: "failed", attempts: 4 },
    });
  });

  test("an error status fails the delivery", async () => {
    send.mockResolvedValue({
      response: { status: 500, contentType: "text/plain", bodyText: "boom", truncated: false },
      error: null,
      attempts: 4,
    });

    await handler(data, jobContext);

    expect(finalWrite().data).toMatchObject({
      status: "failed",
      output: { delivery: "failed", status: 500 },
    });
  });

  test("a step that is no longer sending is never sent again", async () => {
    logFindFirst.mockResolvedValue({ ...sendingRow, status: "succeeded", output: { delivery: "sent" } });

    await handler(data, jobContext);

    expect(send).not.toHaveBeenCalled();
    expect(logUpdateMany).not.toHaveBeenCalled();
  });

  test("a run outside the job's workspace is dropped without sending", async () => {
    runFindFirst.mockResolvedValue(null);

    await handler(data, jobContext);

    expect(runFindFirst.mock.calls[0][0].where).toEqual({
      id: data.workflowRunId,
      workspaceId: data.workspaceId,
    });
    expect(send).not.toHaveBeenCalled();
  });

  test("a secret that is gone fails the delivery without sending", async () => {
    loadSecrets.mockResolvedValue(new Map());

    await handler(data, jobContext);

    expect(send).not.toHaveBeenCalled();
    expect(finalWrite().data).toMatchObject({ status: "failed", output: { delivery: "failed" } });
  });
});
