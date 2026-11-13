import "server-only";
import {
  type TWorkflowHttpRequestDeliveryJobData,
  enqueueWorkflowHttpRequestDeliveryJob,
} from "@formbricks/jobs";
import { sendEmail } from "@/modules/email";
import {
  WORKFLOW_HTTP_RETRIES,
  type WorkflowHttpCall,
  type WorkflowHttpCallResult,
  sendWorkflowHttpRequest,
} from "../http-request/send-http-request";

/**
 * What a "Wait and use it" call gave the step. A Test run's fake also says where its response came
 * from: the step's last Test request response (`used`), or none (`missing`, so the step goes on with
 * no response and run detail flags it).
 */
export type WorkflowRunHttpResult = WorkflowHttpCallResult & { testSample?: "used" | "missing" };

/**
 * Everything a step does outside the run, behind one port. The background job uses the live
 * effects; a Test run (ENG-7181, ADR 0049) swaps in fakes that record "would send" / "would call"
 * instead. New actions add their effect here, and their executors call it through `effects` rather
 * than importing the transport.
 */
export interface WorkflowRunEffects {
  /** Sends one email; `false` when SMTP is not configured. Throws `TooManyRequestsError` when a cap is spent. */
  sendEmail: (input: Parameters<typeof sendEmail>[0]) => Promise<boolean>;
  /**
   * Calls an outside URL for an HTTP request step set to "Wait and use it", with the in-step retries
   * (ENG-7179). Never throws for the call's outcome: no answer comes back as `error`.
   */
  sendHttpRequest: (call: WorkflowHttpCall, step: { stepId: string }) => Promise<WorkflowRunHttpResult>;
  /**
   * Hands a "Don't wait" HTTP request to its own background job, which reads the request from the
   * step's run log. The run moves on without waiting (ADR 0047). `handedOff: false` means nothing
   * will send it (a Test run), so the step ends at once with the request it would have sent.
   */
  enqueueHttpRequestDelivery: (data: TWorkflowHttpRequestDeliveryJobData) => Promise<{ handedOff: boolean }>;
}

export const liveWorkflowRunEffects: WorkflowRunEffects = {
  sendEmail,
  sendHttpRequest: (call) => sendWorkflowHttpRequest(call, { retries: WORKFLOW_HTTP_RETRIES }),
  enqueueHttpRequestDelivery: async (data) => {
    await enqueueWorkflowHttpRequestDeliveryJob(data);
    return { handedOff: true };
  },
};
