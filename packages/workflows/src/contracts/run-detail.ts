import { z } from "zod";
import { ZWorkflowHttpMethod, ZWorkflowHttpResponseMode } from "../types/actions/http-request";
import { ZWorkflowIfElseBranch } from "../types/document";
import { ZWorkflowRunLogStatus } from "../types/runs";
import { ZIsoDateTime } from "./common";

/**
 * Run detail per step (ENG-7181, ENG-7170): what run detail shows for each step, read from the step's
 * log row and typed per step type, plus the steps on a branch the run did not take. The raw log rows
 * stay in `logs`; this is the shape the editor's run drawer and agents read.
 */

export const ZWorkflowRunStepStatus = z
  .enum([...ZWorkflowRunLogStatus.options, "not_taken"])
  .describe(
    "The step's log status, or `not_taken` for a step on an If/else or Switch branch the run did not take. A Don't wait HTTP request reports its delivery separately."
  );
export type TWorkflowRunStepStatus = z.infer<typeof ZWorkflowRunStepStatus>;

export const ZWorkflowRunIfElseDetail = z
  .object({
    kind: z.literal("if_else"),
    branch: ZWorkflowIfElseBranch.nullable().describe("The branch the run took; null until decided."),
    conditions: z
      .array(z.object({ id: z.string(), matched: z.boolean() }).strict())
      .describe("Each condition in order, matched or not matched."),
  })
  .strict();

export const ZWorkflowRunSwitchDetail = z
  .object({
    kind: z.literal("switch"),
    branch: z
      .string()
      .nullable()
      .describe(
        "The branch the run took: the id of the first case that matched, or `default`; null until decided."
      ),
    cases: z
      .array(z.object({ id: z.string(), matched: z.boolean() }).strict())
      .describe("The cases tried, in order, up to and including the one that matched."),
  })
  .strict();

export const ZWorkflowRunSendEmailDetail = z
  .object({
    kind: z.literal("send_email"),
    recipient: z
      .string()
      .nullable()
      .describe("The address the email went to (in a Test run: would go to). Null when none was resolved."),
    subject: z.string().nullable(),
    surveyLink: z.string().nullable().describe("The survey link the email carried, or null."),
  })
  .strict();

export const ZWorkflowRunHttpRequestRecord = z
  .object({
    method: ZWorkflowHttpMethod,
    url: z.string(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }).strict())
      .describe("Headers as sent (in a Test run: as they would be), secret values shown as ••••••."),
    body: z.string().optional(),
    bodyTruncated: z.boolean().optional(),
  })
  .strict();

export const ZWorkflowRunHttpResponseRecord = z
  .object({
    status: z.number().int(),
    contentType: z.string().nullable(),
    body: z.unknown().describe("Parsed JSON when it fits in 64 KB, else up to 64 KB of text."),
    bodyTruncated: z.boolean().optional(),
  })
  .strict();

export const ZWorkflowRunHttpDelivery = z
  .enum(["sending", "sent", "failed"])
  .describe(
    "Don't wait only: `sending` while its own job sends it, then `sent` or `failed`. A failed delivery never fails the run."
  );

export const ZWorkflowRunHttpRequestDetail = z
  .object({
    kind: z.literal("http_request"),
    mode: ZWorkflowHttpResponseMode.nullable(),
    request: ZWorkflowRunHttpRequestRecord.nullable().describe(
      "The request, secret header values masked. Null when it could not be built."
    ),
    response: ZWorkflowRunHttpResponseRecord.nullable().describe(
      "The answer (≤64 KB of body). In a Test run, the step's last Test request response. Null when none came."
    ),
    delivery: ZWorkflowRunHttpDelivery.nullable(),
    testSample: z
      .enum(["used", "missing"])
      .nullable()
      .describe(
        "Test runs only, Wait and use it: `used` when the response is the step's last Test request response, `missing` when the step has none, so later steps saw no response. Null outside Test runs."
      ),
    attempts: z.number().int().nonnegative().nullable(),
    error: z.string().nullable().describe("Why no answer came, when Continue on error let the run go on."),
  })
  .strict();

export const ZWorkflowRunStepDetail = z.discriminatedUnion("kind", [
  ZWorkflowRunIfElseDetail,
  ZWorkflowRunSwitchDetail,
  ZWorkflowRunSendEmailDetail,
  ZWorkflowRunHttpRequestDetail,
]);
export type TWorkflowRunStepDetail = z.infer<typeof ZWorkflowRunStepDetail>;

export const ZWorkflowRunStep = z
  .object({
    stepId: z.string().min(1),
    stepType: z.string().min(1),
    status: ZWorkflowRunStepStatus,
    error: z.string().nullable(),
    startedAt: ZIsoDateTime.nullable(),
    finishedAt: ZIsoDateTime.nullable(),
    detail: ZWorkflowRunStepDetail.nullable().describe(
      "What the step did, by step type. Null for a step not taken and for a step type without detail."
    ),
  })
  .strict()
  .describe("One step of a run as run detail shows it.");
export type TWorkflowRunStep = z.infer<typeof ZWorkflowRunStep>;
