import "server-only";
import { z } from "zod";
import type { TWorkflowSampleData } from "@formbricks/workflows";
import type { WorkflowRunEffects, WorkflowRunHttpResult } from "./effects";

/** A Test request response as `WorkflowSample` keeps it (ENG-7179): status, content type, ≤64 KB body. */
const ZStoredResponse = z.object({
  status: z.number().int(),
  contentType: z.string().nullable().optional(),
  body: z.unknown(),
  bodyTruncated: z.boolean().optional(),
});

const MISSING: WorkflowRunHttpResult = { response: null, error: null, attempts: 0, testSample: "missing" };

const fromSample = (sample: TWorkflowSampleData | undefined): WorkflowRunHttpResult => {
  const parsed = ZStoredResponse.safeParse(sample);
  if (!parsed.success) return MISSING;
  const { status, contentType, body, bodyTruncated } = parsed.data;
  return {
    response: {
      status,
      contentType: contentType ?? null,
      bodyText: typeof body === "string" ? body : JSON.stringify(body ?? null),
      truncated: bodyTruncated === true,
    },
    error: null,
    attempts: 0,
    testSample: "used",
  };
};

/**
 * The fake effects of a Test run (ADR 0049): the walker and the conditions run for real, but nothing
 * leaves the app. An email is reported as handled (the step records whom it would send to) without
 * reaching SMTP, the email caps or the email audit; an HTTP request in "Wait and use it" answers with
 * the step's last Test request response (`samplesByStepId`), or none, flagged; "Don't wait" hands
 * nothing to a job. The rendered call, secret values included, is dropped here and never stored.
 */
export const createTestRunEffects = (
  samplesByStepId: ReadonlyMap<string, TWorkflowSampleData>
): WorkflowRunEffects => ({
  sendEmail: async () => true,
  sendHttpRequest: async (_call, { stepId }) => fromSample(samplesByStepId.get(stepId)),
  enqueueHttpRequestDelivery: async () => ({ handedOff: false }),
});
