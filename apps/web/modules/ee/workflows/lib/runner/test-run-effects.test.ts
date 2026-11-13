import { describe, expect, test, vi } from "vitest";
import { createTestRunEffects } from "./test-run-effects";

vi.mock("@/modules/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@formbricks/jobs", () => ({ enqueueWorkflowHttpRequestDeliveryJob: vi.fn() }));
vi.mock("../http-request/send-http-request", () => ({ sendWorkflowHttpRequest: vi.fn() }));

const call = {
  method: "POST" as const,
  url: "https://api.example.com/x",
  headers: { Authorization: "Bearer sk_live_secret" },
  body: "{}",
};

describe("createTestRunEffects", () => {
  test("an email is reported as handled without reaching any sender", async () => {
    const { sendEmail } = await import("@/modules/email");
    const effects = createTestRunEffects(new Map());

    await expect(
      effects.sendEmail({ to: "ana@example.com", subject: "Hi", html: "<p>Hi</p>" } as never)
    ).resolves.toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("Wait and use it answers with the step's last Test request response, calling nothing", async () => {
    const { sendWorkflowHttpRequest } = await import("../http-request/send-http-request");
    const effects = createTestRunEffects(
      new Map([
        ["call", { status: 201, contentType: "application/json", body: { id: "c_1" } }],
        ["text", { status: 200, contentType: "text/plain", body: "ok", bodyTruncated: true }],
      ])
    );

    await expect(effects.sendHttpRequest(call, { stepId: "call" })).resolves.toEqual({
      response: { status: 201, contentType: "application/json", bodyText: '{"id":"c_1"}', truncated: false },
      error: null,
      attempts: 0,
      testSample: "used",
    });
    await expect(effects.sendHttpRequest(call, { stepId: "text" })).resolves.toMatchObject({
      response: { status: 200, contentType: "text/plain", bodyText: "ok", truncated: true },
    });
    expect(sendWorkflowHttpRequest).not.toHaveBeenCalled();
  });

  test("a step without a usable Test request response gets none, flagged as missing", async () => {
    const effects = createTestRunEffects(new Map([["broken", { body: "no status" }]]));

    for (const stepId of ["other", "broken"]) {
      await expect(effects.sendHttpRequest(call, { stepId })).resolves.toEqual({
        response: null,
        error: null,
        attempts: 0,
        testSample: "missing",
      });
    }
  });

  test("Don't wait hands nothing to a job", async () => {
    const { enqueueWorkflowHttpRequestDeliveryJob } = await import("@formbricks/jobs");
    const effects = createTestRunEffects(new Map());

    await expect(
      effects.enqueueHttpRequestDelivery({
        workflowRunId: "run_1",
        workflowId: "wf_1",
        workspaceId: "ws_1",
        stepId: "call",
      })
    ).resolves.toEqual({ handedOff: false });
    expect(enqueueWorkflowHttpRequestDeliveryJob).not.toHaveBeenCalled();
  });
});
