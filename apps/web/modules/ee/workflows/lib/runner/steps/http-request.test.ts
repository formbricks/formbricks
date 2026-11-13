import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  TWorkflowHttpRequestActionConfig,
  TWorkflowHttpRequestActionNode,
  TWorkflowRunContext,
} from "@formbricks/workflows";
import type { WorkflowHttpCallResult } from "../../http-request/send-http-request";
import type { WorkflowRunEffects } from "../effects";
import type { WorkflowRunEnvironment } from "../run-environment";
import { httpRequestStepExecutor } from "./http-request";

vi.mock("@/modules/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@formbricks/jobs", () => ({ enqueueWorkflowHttpRequestDeliveryJob: vi.fn() }));

const SECRET = "sk_live_never_logged";
const ids = { runId: "run_1", workflowId: "wf_1", workspaceId: "ws_1" };

const node = (config: Partial<TWorkflowHttpRequestActionConfig> = {}): TWorkflowHttpRequestActionNode => ({
  id: "call",
  type: "action",
  actionType: "http_request",
  config: {
    method: "POST",
    url: "https://api.example.com/customers?source=fb",
    queryParameters: [{ name: "email", value: "#recall:payload.email/fallback:#" }],
    headers: [
      { name: "Authorization", secret: true, secretId: "sec_1" },
      { name: "X-Name", value: "#recall:payload.name/fallback:#" },
    ],
    body: JSON.stringify({
      tier: "#recall:payload.tier/fallback:#",
      note: "for #recall:payload.name/fallback:#",
    }),
    responseMode: "wait",
    continueOnError: false,
    ...config,
  },
});

const context: TWorkflowRunContext = {
  payload: { email: "ana+vip@example.com", name: "Ana\r\nX-Evil: 1", tier: 3 },
  steps: {},
};

const environment = {
  ...ids,
  secretValues: new Map([["sec_1", `Bearer ${SECRET}`]]),
} as unknown as WorkflowRunEnvironment;

const answer = (
  status: number,
  bodyText: string,
  contentType = "application/json"
): WorkflowHttpCallResult => ({
  response: { status, contentType, bodyText, truncated: false },
  error: null,
  attempts: 1,
});

const effects = {
  sendEmail: vi.fn(),
  sendHttpRequest: vi.fn<WorkflowRunEffects["sendHttpRequest"]>(),
  enqueueHttpRequestDelivery: vi.fn<WorkflowRunEffects["enqueueHttpRequestDelivery"]>(),
};

const run = (config?: Partial<TWorkflowHttpRequestActionConfig>) =>
  httpRequestStepExecutor.execute({ node: node(config), context, environment, effects });

beforeEach(() => {
  vi.clearAllMocks();
  effects.sendHttpRequest.mockResolvedValue(answer(201, '{"id":"c_1","plan":{"name":"pro"}}'));
  effects.enqueueHttpRequestDelivery.mockResolvedValue({ handedOff: true });
});

describe("httpRequestStepExecutor", () => {
  test("sends the rendered request: encoded query values, decrypted secrets, safe headers, typed JSON", async () => {
    await run();

    expect(effects.sendHttpRequest).toHaveBeenCalledWith(
      {
        method: "POST",
        url: "https://api.example.com/customers?source=fb&email=ana%2Bvip%40example.com",
        headers: {
          Authorization: `Bearer ${SECRET}`,
          "X-Name": "AnaX-Evil: 1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tier: 3, note: "for Ana\r\nX-Evil: 1" }),
      },
      { stepId: "call" }
    );
  });

  test("later steps read the status and the parsed body; the log keeps the request with secrets masked", async () => {
    const outcome = await run();

    expect(outcome.status).toBe("succeeded");
    expect(outcome.variables).toEqual({ status: 201, body: { id: "c_1", plan: { name: "pro" } } });
    expect(outcome.output).toMatchObject({
      mode: "wait",
      status: 201,
      contentType: "application/json",
      body: { id: "c_1", plan: { name: "pro" } },
      request: {
        method: "POST",
        headers: expect.arrayContaining([{ name: "Authorization", value: "••••••" }]),
      },
    });
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });

  test("an endpoint that echoes the secret header back gets it masked in the log", async () => {
    effects.sendHttpRequest.mockResolvedValue(
      answer(200, JSON.stringify({ headers: { Authorization: `Bearer ${SECRET}` } }))
    );

    const outcome = await run();

    expect(outcome.output.body).toEqual({ headers: { Authorization: "••••••" } });
    expect(JSON.stringify(outcome.output)).not.toContain(SECRET);
  });

  test("the log keeps at most 64 KB of the response; later steps still get all of it", async () => {
    const big = JSON.stringify({ items: "x".repeat(70 * 1024) });
    effects.sendHttpRequest.mockResolvedValue(answer(200, big));

    const outcome = await run();

    expect(outcome.variables?.body).toEqual(JSON.parse(big));
    expect(outcome.output.bodyTruncated).toBe(true);
    expect(outcome.output.body as string).toHaveLength(64 * 1024);
  });

  test("an error answer fails the step and the run, with the call recorded", async () => {
    effects.sendHttpRequest.mockResolvedValue(answer(502, "bad gateway", "text/plain"));

    const outcome = await run();

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toMatch(/502/);
    expect(outcome.output).toMatchObject({ status: 502, body: "bad gateway" });
  });

  test("Continue on error passes the status on instead of failing the run", async () => {
    effects.sendHttpRequest.mockResolvedValue(answer(404, '{"error":"no such customer"}'));

    const outcome = await run({ continueOnError: true });

    expect(outcome.status).toBe("succeeded");
    expect(outcome.variables).toEqual({ status: 404, body: { error: "no such customer" } });
  });

  test("no answer at all fails the step, or with Continue on error leaves the status missing", async () => {
    effects.sendHttpRequest.mockResolvedValue({
      response: null,
      error: "The request timed out after 10 s",
      attempts: 4,
    });

    expect(await run()).toMatchObject({ status: "failed", error: "The request timed out after 10 s" });
    expect(await run({ continueOnError: true })).toMatchObject({ status: "succeeded", variables: {} });
  });

  test("a secret header without a stored value fails before anything is sent", async () => {
    const outcome = await httpRequestStepExecutor.execute({
      node: node(),
      context,
      environment: { ...environment, secretValues: new Map() },
      effects,
    });

    expect(outcome).toMatchObject({ status: "failed", error: expect.stringContaining("Authorization") });
    expect(effects.sendHttpRequest).not.toHaveBeenCalled();
  });

  test("GET and DELETE never send a body", async () => {
    await run({ method: "GET" });

    expect(effects.sendHttpRequest.mock.calls[0][0]).not.toHaveProperty("body");
    expect(effects.sendHttpRequest.mock.calls[0][0].headers).not.toHaveProperty("content-type");
  });

  test("Don't wait hands the call to its own job and leaves the step sending", async () => {
    const outcome = await run({ responseMode: "dont_wait" });

    expect(effects.sendHttpRequest).not.toHaveBeenCalled();
    expect(effects.enqueueHttpRequestDelivery).toHaveBeenCalledWith({
      workflowRunId: "run_1",
      workflowId: "wf_1",
      workspaceId: "ws_1",
      stepId: "call",
    });
    expect(outcome).toMatchObject({ status: "running", output: { mode: "dont_wait", delivery: "sending" } });
    expect(httpRequestStepExecutor.handedOff?.(outcome.output)).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });

  test("in a Test run, uses the step's last Test request response and says so", async () => {
    effects.sendHttpRequest.mockResolvedValue({ ...answer(200, '{"plan":"pro"}'), testSample: "used" });

    const outcome = await run();

    expect(outcome).toMatchObject({
      status: "succeeded",
      output: { mode: "wait", testSample: "used", status: 200, body: { plan: "pro" } },
      variables: { status: 200, body: { plan: "pro" } },
    });
  });

  test("in a Test run without a Test request response, goes on with no response, flagged", async () => {
    effects.sendHttpRequest.mockResolvedValue({
      response: null,
      error: null,
      attempts: 0,
      testSample: "missing",
    });

    const outcome = await run();

    expect(outcome.status).toBe("succeeded");
    expect(outcome.output).toMatchObject({ mode: "wait", testSample: "missing" });
    expect(outcome.output).not.toHaveProperty("status");
    expect(outcome.variables).toEqual({});
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });

  test("Don't wait in a Test run hands nothing off: the step ends with the request it would send", async () => {
    effects.enqueueHttpRequestDelivery.mockResolvedValue({ handedOff: false });

    const outcome = await run({ responseMode: "dont_wait" });

    expect(outcome.status).toBe("succeeded");
    expect(outcome.output).toMatchObject({ mode: "dont_wait", request: { method: "POST" } });
    expect(outcome.output).not.toHaveProperty("delivery");
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });
});
