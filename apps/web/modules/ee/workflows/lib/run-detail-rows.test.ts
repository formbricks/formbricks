import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition, TWorkflowRunResource, TWorkflowRunStep } from "@formbricks/workflows";
import { type TRunDetailRow, getRunContentDeletedDays, toRunDetailRows } from "./run-detail-rows";

const badgeOf = (row: TRunDetailRow) => (row.kind === "trigger" ? null : row.badge);

// A Webhook workflow: If/else "Enterprise customer?" → Then: Send email, Else: HTTP request.
const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "branch",
      type: "if_else",
      label: "Enterprise customer?",
      config: {
        condition: {
          id: "group",
          connector: "and",
          conditions: [
            { id: "c1", left: { path: "payload.channel" }, operator: "equals", right: "call" },
            {
              id: "nested",
              connector: "or",
              conditions: [
                { id: "c2", left: { path: "payload.resolved" }, operator: "equals", right: false },
              ],
            },
          ],
        },
      },
    },
    { id: "email", type: "action", actionType: "send_email", config: {} },
    { id: "http", type: "action", actionType: "http_request", label: "Data layer", config: {} },
    { id: "after-http", type: "action", actionType: "send_email", config: {} },
  ],
  edges: [
    { id: "e0", source: "trigger", target: "branch" },
    { id: "e1", source: "branch", sourceHandle: "then", target: "email" },
    { id: "e2", source: "branch", sourceHandle: "else", target: "http" },
    { id: "e3", source: "http", target: "after-http" },
  ],
} as unknown as TWorkflowDefinition;

const step = (overrides: Partial<TWorkflowRunStep> & Pick<TWorkflowRunStep, "stepId">): TWorkflowRunStep => ({
  stepType: "send_email",
  status: "succeeded",
  error: null,
  startedAt: null,
  finishedAt: null,
  detail: null,
  ...overrides,
});

const buildRun = (overrides: Partial<TWorkflowRunResource> = {}): TWorkflowRunResource =>
  ({
    id: "run_1",
    isDryRun: false,
    triggerType: "webhook",
    triggerPayload: {
      type: "webhook",
      workspaceId: "ws",
      payload: { channel: "call" },
      triggeredAt: "2026-11-12T09:31:12.000Z",
    },
    steps: [],
    ...overrides,
  }) as TWorkflowRunResource;

describe("toRunDetailRows", () => {
  test("starts with the trigger and its payload, then the steps in order, numbered from 2", () => {
    const rows = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "branch",
            stepType: "if_else",
            startedAt: "2026-11-12T09:31:12.000Z",
            finishedAt: "2026-11-12T09:31:12.002Z",
          }),
          step({
            stepId: "email",
            detail: { kind: "send_email", recipient: null, subject: null, surveyLink: null },
          }),
        ],
      }),
      definition
    );

    expect(rows.map((row) => [row.position, row.kind, row.stepId])).toEqual([
      [1, "trigger", null],
      [2, "if_else", "branch"],
      [3, "send_email", "email"],
    ]);
    expect(rows[0]).toMatchObject({ triggerType: "webhook", payload: { channel: "call" } });
    expect(rows[1]).toMatchObject({ label: "Enterprise customer?", duration: "2ms" });
    expect(rows[2]).toMatchObject({ label: null, duration: null });
  });

  test("an If/else lists each condition with its text and whether it matched, and the branch taken", () => {
    const [, ifElse] = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "branch",
            stepType: "if_else",
            detail: {
              kind: "if_else",
              branch: "else",
              conditions: [
                { id: "c1", matched: true },
                { id: "c2", matched: false },
              ],
            },
          }),
        ],
      }),
      definition
    );

    expect(ifElse).toMatchObject({
      kind: "if_else",
      branch: "else",
      conditions: [
        {
          id: "c1",
          matched: true,
          condition: { left: { path: "payload.channel" }, operator: "equals", right: "call" },
        },
        {
          id: "c2",
          matched: false,
          condition: { left: { path: "payload.resolved" }, operator: "equals", right: false },
        },
      ],
    });
  });

  test("a condition the definition no longer has keeps its result without a text", () => {
    const [, ifElse] = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "branch",
            stepType: "if_else",
            detail: { kind: "if_else", branch: "then", conditions: [{ id: "gone", matched: true }] },
          }),
        ],
      }),
      null
    );

    expect(ifElse).toMatchObject({ conditions: [{ id: "gone", matched: true, condition: null }] });
  });

  test("a step on the branch not taken says which branch it is on, also below that branch's first step", () => {
    const rows = toRunDetailRows(
      buildRun({
        steps: [
          step({ stepId: "email" }),
          step({ stepId: "http", stepType: "http_request", status: "not_taken" }),
          step({ stepId: "after-http", status: "not_taken" }),
        ],
      }),
      definition
    );

    expect(
      rows.slice(2).map((row) => [row.kind, badgeOf(row), row.kind === "not_taken" && row.branch])
    ).toEqual([
      ["not_taken", "not_taken", "else"],
      ["not_taken", "not_taken", "else"],
    ]);
    expect(rows[2]).toMatchObject({ stepType: "http_request", label: "Data layer" });
  });

  test("without the definition a step not taken has no branch", () => {
    const [, notTaken] = toRunDetailRows(
      buildRun({ steps: [step({ stepId: "http", status: "not_taken" })] }),
      null
    );
    expect(notTaken).toMatchObject({ kind: "not_taken", branch: null, label: null });
  });

  test("a sent email shows its recipient, subject and survey link", () => {
    const [, email] = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "email",
            detail: {
              kind: "send_email",
              recipient: "lena@example.com",
              subject: "How was your call?",
              surveyLink: "https://app.example/s/abc?agent_id=A-42",
            },
          }),
        ],
      }),
      definition
    );

    expect(email).toMatchObject({
      kind: "send_email",
      badge: "succeeded",
      recipient: "lena@example.com",
      subject: "How was your call?",
      surveyLink: "https://app.example/s/abc?agent_id=A-42",
    });
  });

  test("in a Test run, a succeeded email or HTTP request reads 'would send'; a failed one stays failed", () => {
    const rows = toRunDetailRows(
      buildRun({
        isDryRun: true,
        steps: [
          step({ stepId: "email" }),
          step({ stepId: "http", stepType: "http_request" }),
          step({ stepId: "after-http", status: "failed", error: "No recipient" }),
        ],
      }),
      definition
    );

    expect(rows.slice(1).map((row) => badgeOf(row))).toEqual(["would_send", "would_send", "failed"]);
    expect(rows[3]).toMatchObject({ error: "No recipient" });
  });

  test("an HTTP request shows the request as sent, secret header values as recorded, and the response", () => {
    const [, http] = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "http",
            stepType: "http_request",
            detail: {
              kind: "http_request",
              mode: "wait",
              request: {
                method: "POST",
                url: "https://dl.example/interactions",
                headers: [
                  { name: "Authorization", value: "••••••" },
                  { name: "Content-Type", value: "application/json" },
                ],
                body: '{"customer_id":"C-1"}',
              },
              response: { status: 201, contentType: "application/json", body: { id: "int_1" } },
              delivery: null,
              testSample: null,
              attempts: 1,
              error: null,
            },
          }),
        ],
      }),
      definition
    );

    expect(http).toMatchObject({
      kind: "http_request",
      badge: "succeeded",
      requestText:
        'POST https://dl.example/interactions\nAuthorization: ••••••\nContent-Type: application/json\n\n{"customer_id":"C-1"}',
      requestBodyTruncated: false,
      response: { status: 201, bodyText: '{\n  "id": "int_1"\n}', bodyTruncated: false },
    });
  });

  test("a text response body is shown as is", () => {
    const [, http] = toRunDetailRows(
      buildRun({
        steps: [
          step({
            stepId: "http",
            stepType: "http_request",
            detail: {
              kind: "http_request",
              mode: "wait",
              request: { method: "GET", url: "https://x.example", headers: [] },
              response: { status: 500, contentType: "text/plain", body: "oops", bodyTruncated: true },
              delivery: null,
              testSample: null,
              attempts: 3,
              error: "Server error",
            },
          }),
        ],
      }),
      definition
    );

    expect(http).toMatchObject({
      requestText: "GET https://x.example",
      response: { status: 500, bodyText: "oops", bodyTruncated: true },
      httpError: "Server error",
    });
  });

  test("a Don't wait request shows its delivery: sending, sent or failed", () => {
    const dontWait = (delivery: "sending" | "sent" | "failed") =>
      step({
        stepId: "http",
        stepType: "http_request",
        detail: {
          kind: "http_request",
          mode: "dont_wait",
          request: null,
          response: null,
          delivery,
          testSample: null,
          attempts: null,
          error: null,
        },
      });

    const badges = (["sending", "sent", "failed"] as const).map((delivery) =>
      badgeOf(toRunDetailRows(buildRun({ steps: [dontWait(delivery)] }), definition)[1])
    );

    expect(badges).toEqual(["sending", "sent", "delivery_failed"]);
  });

  test("a Test run's HTTP request says whether a Test request response stood in for the answer", () => {
    const [, http] = toRunDetailRows(
      buildRun({
        isDryRun: true,
        steps: [
          step({
            stepId: "http",
            stepType: "http_request",
            detail: {
              kind: "http_request",
              mode: "wait",
              request: { method: "GET", url: "https://x.example", headers: [] },
              response: null,
              delivery: null,
              testSample: "missing",
              attempts: null,
              error: null,
            },
          }),
        ],
      }),
      definition
    );

    expect(http).toMatchObject({ badge: "would_send", testSample: "missing", response: null });
  });

  test("a response-completed run starts with the response it came from", () => {
    const [trigger] = toRunDetailRows(
      buildRun({
        triggerType: "response.completed",
        triggerPayload: {
          type: "response.completed",
          workspaceId: "ws",
          surveyId: "s1",
          responseId: "r1",
          triggeredAt: "2026-11-12T09:31:12.000Z",
        } as TWorkflowRunResource["triggerPayload"],
      }),
      null
    );

    expect(trigger).toMatchObject({ kind: "trigger", triggerType: "response.completed", payload: null });
  });

  test("a step type without a detail is shown with its status only", () => {
    const [, other] = toRunDetailRows(
      buildRun({ steps: [step({ stepId: "x", stepType: "future_step", status: "skipped" })] }),
      null
    );
    expect(other).toMatchObject({ kind: "other", stepType: "future_step", badge: "skipped" });
  });
});

describe("a run whose details were deleted", () => {
  const deleted = buildRun({
    triggerPayload: {
      type: "webhook",
      workspaceId: "ws",
      payload: {},
      triggeredAt: "2026-08-01T09:31:12.000Z",
    },
    steps: [step({ stepId: "email", status: "failed" })],
    contentDeletedAt: "2026-11-01T09:31:12.000Z",
    contentRetentionDays: 90,
  });

  test("shows only the trigger, without a payload, instead of its steps", () => {
    expect(toRunDetailRows(deleted, definition)).toEqual([
      { kind: "trigger", position: 1, stepId: null, triggerType: "webhook", payload: null },
    ]);
  });

  test("says after how many days the details were deleted", () => {
    expect(getRunContentDeletedDays(deleted)).toBe(90);
  });

  test("a run whose details are kept has no deletion notice", () => {
    expect(
      getRunContentDeletedDays(buildRun({ contentDeletedAt: null, contentRetentionDays: null }))
    ).toBeNull();
  });
});
