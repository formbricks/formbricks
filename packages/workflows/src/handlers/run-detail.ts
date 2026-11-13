import { z } from "zod";
import {
  type TWorkflowRunStep,
  type TWorkflowRunStepDetail,
  ZWorkflowRunHttpDelivery,
  ZWorkflowRunHttpRequestRecord,
  ZWorkflowRunHttpResponseRecord,
} from "../contracts/run-detail";
import type { WorkflowRunLogRow } from "../services/ports";
import { ZWorkflowHttpResponseMode } from "../types/actions/http-request";
import { ZWorkflowIfElseBranch } from "../types/document";
import type { TWorkflowRunData } from "../types/runs";

/**
 * Builds run detail per step (ENG-7181) from a run's log rows and the steps its If/else and Switch steps did
 * not take. Log `input`/`output` are free-form JSON written by the runner (and, for older runs, by
 * older runners), so every field is read with a tolerant parse: a shape this code doesn't know comes
 * back as null rather than failing the whole run read.
 */

const readAs = <T>(schema: z.ZodType<T>, value: unknown): T | null => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const ZString = z.string();
const ZConditionResults = z.array(z.object({ id: z.string(), matched: z.boolean() }));
const ZAttempts = z.number().int().nonnegative();
const ZTestSample = z.enum(["used", "missing"]);

const describeIfElse = (output: Record<string, unknown>): TWorkflowRunStepDetail => ({
  kind: "if_else",
  branch: readAs(ZWorkflowIfElseBranch, output.branch),
  conditions: (readAs(ZConditionResults, output.conditions) ?? []).map(({ id, matched }) => ({
    id,
    matched,
  })),
});

const describeSwitch = (output: Record<string, unknown>): TWorkflowRunStepDetail => ({
  kind: "switch",
  branch: readAs(ZString, output.branch),
  cases: (readAs(ZConditionResults, output.cases) ?? []).map(({ id, matched }) => ({ id, matched })),
});

const describeSendEmail = (
  input: Record<string, unknown>,
  output: Record<string, unknown>
): TWorkflowRunStepDetail => ({
  kind: "send_email",
  recipient: readAs(ZString, output.recipient),
  subject: readAs(ZString, input.subject),
  surveyLink: readAs(ZString, output.surveyLink),
});

const pickRequest = (value: unknown) => {
  const request = readAs(ZWorkflowRunHttpRequestRecord.loose(), value);
  if (!request) return null;
  return {
    method: request.method,
    url: request.url,
    headers: request.headers.map(({ name, value: headerValue }) => ({ name, value: headerValue })),
    ...(request.body === undefined ? {} : { body: request.body }),
    ...(request.bodyTruncated ? { bodyTruncated: true } : {}),
  };
};

/** The response fields sit beside `request` on the log output (`status`, `contentType`, `body`). */
const pickResponse = (output: Record<string, unknown>) => {
  const response = readAs(ZWorkflowRunHttpResponseRecord.loose(), {
    status: output.status,
    contentType: output.contentType ?? null,
    body: output.body,
    bodyTruncated: output.bodyTruncated,
  });
  if (!response) return null;
  return {
    status: response.status,
    contentType: response.contentType,
    body: response.body,
    ...(response.bodyTruncated ? { bodyTruncated: true } : {}),
  };
};

const describeHttpRequest = (output: Record<string, unknown>): TWorkflowRunStepDetail => ({
  kind: "http_request",
  mode: readAs(ZWorkflowHttpResponseMode, output.mode),
  request: pickRequest(output.request),
  response: pickResponse(output),
  delivery: readAs(ZWorkflowRunHttpDelivery, output.delivery),
  testSample: readAs(ZTestSample, output.testSample),
  attempts: readAs(ZAttempts, output.attempts),
  error: readAs(ZString, output.error),
});

const describeLog = (log: WorkflowRunLogRow): TWorkflowRunStepDetail | null => {
  const { input, output } = log;
  switch (log.stepType) {
    case "if_else":
      return describeIfElse(output);
    case "switch":
      return describeSwitch(output);
    case "send_email":
      return describeSendEmail(input, output);
    case "http_request":
      return describeHttpRequest(output);
    default:
      return null;
  }
};

const toIso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/**
 * The run's steps in walk order, then the steps on branches it did not take. `withDetail: false` (a run
 * whose content was deleted) keeps each step's status and timing and leaves `detail` null.
 */
export const describeWorkflowRunSteps = (
  logs: WorkflowRunLogRow[],
  notTaken: TWorkflowRunData["notTaken"],
  { withDetail = true }: { withDetail?: boolean } = {}
): TWorkflowRunStep[] => [
  ...logs.map((log) => ({
    stepId: log.stepId,
    stepType: log.stepType,
    status: log.status,
    error: log.error,
    startedAt: toIso(log.startedAt),
    finishedAt: toIso(log.finishedAt),
    detail: withDetail ? describeLog(log) : null,
  })),
  ...(notTaken ?? []).map((step) => ({
    stepId: step.stepId,
    stepType: step.stepType,
    status: "not_taken" as const,
    error: null,
    startedAt: null,
    finishedAt: null,
    detail: null,
  })),
];
