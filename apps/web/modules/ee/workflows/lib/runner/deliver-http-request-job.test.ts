import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import type { TWorkflowHttpRequestDeliveryJobData } from "@formbricks/jobs";
import type { WorkflowHttpCallResult } from "../http-request/send-http-request";
import {
  createWorkflowHttpRequestDeliveryJobHandler,
  processWorkflowHttpRequestDeliveryJob,
} from "./deliver-http-request-job";

const { runFindFirst, logFindFirst, logUpdateMany, loadSecrets, liveSend } = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  logFindFirst: vi.fn(),
  logUpdateMany: vi.fn(),
  loadSecrets: vi.fn(),
  liveSend: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: { findFirst: runFindFirst },
    workflowRunLog: { findFirst: logFindFirst, updateMany: logUpdateMany },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/ee/workflows/lib/secret-headers/workflow-secret-store", () => ({
  loadWorkflowSecretValues: loadSecrets,
}));
// Only the production handler's default sender reaches this; the other tests inject `send`.
vi.mock("@/modules/ee/workflows/lib/http-request/send-http-request", () => ({
  sendWorkflowHttpRequest: liveSend,
}));

const SECRET = "Bearer sk_live_job";
const SLASHED_SECRET = "Bearer sk_live/job";

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
  loadSecrets.mockResolvedValue(
    new Map([["sec_1", { value: SECRET, boundOrigin: "https://api.example.com" }]])
  );
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

  test("the production handler sends with 3 retries, as a waiting step does", async () => {
    liveSend.mockResolvedValue({ response: null, error: "The request timed out after 10 s", attempts: 4 });

    await processWorkflowHttpRequestDeliveryJob(data, jobContext);

    expect(liveSend).toHaveBeenCalledTimes(1);
    expect(liveSend.mock.calls[0][1]).toEqual({ retries: 3 });
  });

  test.each([
    ["byte for byte", JSON.stringify({ youSent: SLASHED_SECRET })],
    ["with escaped slashes (PHP's default)", String.raw`{"youSent":"Bearer sk_live\/job"}`],
  ])("masks a secret the target echoes back %s in the step's stored output", async (_, bodyText) => {
    loadSecrets.mockResolvedValue(
      new Map([["sec_1", { value: SLASHED_SECRET, boundOrigin: "https://api.example.com" }]])
    );
    send.mockResolvedValue({
      response: { status: 200, contentType: "application/json", bodyText, truncated: false },
      error: null,
      attempts: 1,
    });

    await handler(data, jobContext);

    expect(send.mock.calls[0][0]).toMatchObject({ headers: { Authorization: SLASHED_SECRET } });
    expect(finalWrite().data).toMatchObject({ output: { body: { youSent: "••••••" } } });
    expect(JSON.stringify(logUpdateMany.mock.calls)).not.toContain("sk_live/job");
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

  test("a secret now set for another host is not sent: the delivery fails naming the header and that host", async () => {
    loadSecrets.mockResolvedValue(
      new Map([["sec_1", { value: SECRET, boundOrigin: "https://new-api.example.com" }]])
    );

    await handler(data, jobContext);

    expect(send).not.toHaveBeenCalled();
    expect(finalWrite().data).toMatchObject({
      status: "failed",
      error: "Secret header Authorization is set for new-api.example.com; enter it again for the new URL",
      output: { delivery: "failed" },
    });
    expect(JSON.stringify(logUpdateMany.mock.calls)).not.toContain(SECRET);
  });

  describe("a delivery run again (a stalled worker's job, or a duplicate)", () => {
    type FakeRow = { status: string; output: Record<string, unknown> };
    type PathFilter = { output: { path: string[]; equals: unknown } };

    /**
     * One log row the deliveries share, with the guards of `updateMany` applied the way Postgres does:
     * `status`, plus `output` path filters where `Prisma.DbNull` matches a missing key.
     */
    const shareOneRow = () => {
      const row: FakeRow = structuredClone(sendingRow);
      logFindFirst.mockImplementation(async () => structuredClone(row));
      logUpdateMany.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { status?: string; AND?: PathFilter[] };
          data: Partial<FakeRow>;
        }) => {
          const matches =
            (where.status === undefined || where.status === row.status) &&
            (where.AND ?? []).every(({ output: { path, equals } }) => {
              const value = row.output[path[0]];
              return equals === Prisma.DbNull ? value === undefined || value === null : value === equals;
            });
          if (!matches) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }
      );
      return row;
    };

    test("a re-run after the first worker stalled mid-send does not send again", async () => {
      const row = shareOneRow();
      // The first worker's call never comes back: its process stalled or died while sending.
      send.mockReturnValueOnce(new Promise<WorkflowHttpCallResult>(() => {}));
      void handler(data, jobContext);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

      await handler(data, jobContext);

      expect(send).toHaveBeenCalledTimes(1);
      // Left `sending` for the hourly cleanup, which fails it as "may or may not have reached its target".
      expect(row.status).toBe("running");
      expect(row.output.delivery).toBe("sending");
    });

    test("two deliveries that read the row at the same time send it once", async () => {
      const row = shareOneRow();

      await Promise.all([handler(data, jobContext), handler(data, jobContext)]);

      expect(send).toHaveBeenCalledTimes(1);
      expect(row.status).toBe("succeeded");
      expect(row.output).toMatchObject({ delivery: "sent", status: 202 });
      expect(row.output.deliveryStartedAt).toBeUndefined();
    });
  });
});
