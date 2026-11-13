import { describe, expect, test } from "vitest";
import { ZWorkflowRunStep } from "../contracts/run-detail";
import type { WorkflowRunLogRow } from "../services/ports";
import { describeWorkflowRunSteps } from "./run-detail";

const STARTED = new Date("2026-11-13T10:00:00.000Z");
const FINISHED = new Date("2026-11-13T10:00:01.000Z");

const log = (row: Partial<WorkflowRunLogRow> & Pick<WorkflowRunLogRow, "stepId" | "stepType">) => ({
  id: `log_${row.stepId}`,
  runId: "run_1",
  sequence: 1,
  status: "succeeded" as const,
  input: {},
  output: {},
  error: null,
  startedAt: STARTED,
  finishedAt: FINISHED,
  ...row,
});

describe("describeWorkflowRunSteps", () => {
  test("shows the branch an If/else took and each condition as matched or not matched", () => {
    const [step] = describeWorkflowRunSteps(
      [
        log({
          stepId: "check",
          stepType: "if_else",
          output: {
            branch: "else",
            matched: false,
            conditions: [
              { id: "c1", matched: true },
              { id: "c2", matched: false },
            ],
          },
        }),
      ],
      undefined
    );

    expect(step).toEqual({
      stepId: "check",
      stepType: "if_else",
      status: "succeeded",
      error: null,
      startedAt: STARTED.toISOString(),
      finishedAt: FINISHED.toISOString(),
      detail: {
        kind: "if_else",
        branch: "else",
        conditions: [
          { id: "c1", matched: true },
          { id: "c2", matched: false },
        ],
      },
    });
  });

  test("shows whom an email went to, its subject and the survey link", () => {
    const [step] = describeWorkflowRunSteps(
      [
        log({
          stepId: "mail",
          stepType: "send_email",
          input: { to: "#recall:payload.email#", subject: "Welcome" },
          output: {
            messageId: "<x@y>",
            provider: "smtp",
            recipient: "ana@example.com",
            surveyLink: "https://app.example.com/s/s1?plan=pro",
          },
        }),
      ],
      undefined
    );

    expect(step.detail).toEqual({
      kind: "send_email",
      recipient: "ana@example.com",
      subject: "Welcome",
      surveyLink: "https://app.example.com/s/s1?plan=pro",
    });
  });

  test("shows an HTTP request with its masked request, response and delivery state", () => {
    const steps = describeWorkflowRunSteps(
      [
        log({
          stepId: "call",
          stepType: "http_request",
          output: {
            mode: "wait",
            request: {
              method: "POST",
              url: "https://api.example.com/x",
              headers: [{ name: "Authorization", value: "••••••" }],
              body: '{"a":1}',
            },
            status: 201,
            contentType: "application/json",
            body: { id: "c_1" },
            attempts: 1,
          },
        }),
        log({
          stepId: "notify",
          stepType: "http_request",
          sequence: 2,
          status: "running",
          finishedAt: null,
          output: {
            mode: "dont_wait",
            delivery: "sending",
            request: { method: "GET", url: "https://api.example.com/y", headers: [] },
          },
        }),
      ],
      undefined
    );

    expect(steps[0].detail).toEqual({
      kind: "http_request",
      mode: "wait",
      request: {
        method: "POST",
        url: "https://api.example.com/x",
        headers: [{ name: "Authorization", value: "••••••" }],
        body: '{"a":1}',
      },
      response: { status: 201, contentType: "application/json", body: { id: "c_1" } },
      delivery: null,
      testSample: null,
      attempts: 1,
      error: null,
    });
    expect(steps[1]).toMatchObject({
      status: "running",
      finishedAt: null,
      detail: { mode: "dont_wait", delivery: "sending", response: null },
    });
  });

  test("flags a Test run's HTTP request that had no Test request response", () => {
    const [step] = describeWorkflowRunSteps(
      [
        log({
          stepId: "call",
          stepType: "http_request",
          output: {
            mode: "wait",
            testSample: "missing",
            request: { method: "GET", url: "https://api.example.com/x", headers: [] },
          },
        }),
      ],
      undefined
    );

    expect(step.detail).toMatchObject({ testSample: "missing", response: null });
  });

  test("lists the steps on the branch not taken after the steps that ran", () => {
    const steps = describeWorkflowRunSteps(
      [log({ stepId: "check", stepType: "if_else", output: { branch: "then", conditions: [] } })],
      [
        { stepId: "b", stepType: "send_email" },
        { stepId: "b2", stepType: "http_request" },
      ]
    );

    expect(steps.map((step) => [step.stepId, step.status])).toEqual([
      ["check", "succeeded"],
      ["b", "not_taken"],
      ["b2", "not_taken"],
    ]);
    expect(steps[1]).toEqual({
      stepId: "b",
      stepType: "send_email",
      status: "not_taken",
      error: null,
      startedAt: null,
      finishedAt: null,
      detail: null,
    });
  });

  test("tolerates a log row whose output does not have the expected shape", () => {
    const steps = describeWorkflowRunSteps(
      [
        log({ stepId: "check", stepType: "if_else", output: { branch: "maybe", conditions: "x" } }),
        log({ stepId: "call", stepType: "http_request", output: { request: "nope", status: "201" } }),
        log({ stepId: "later", stepType: "future_step", output: { anything: true } }),
      ],
      undefined
    );

    for (const step of steps) expect(ZWorkflowRunStep.safeParse(step).success).toBe(true);
    expect(steps[0].detail).toEqual({ kind: "if_else", branch: null, conditions: [] });
    expect(steps[1].detail).toMatchObject({ request: null, response: null });
    expect(steps[2].detail).toBeNull();
  });
});
