import "server-only";
import { sendEmail } from "@/modules/email";

/**
 * Everything a step does outside the run, behind one port. The background job uses the live
 * effects; a Test run (ENG-7181, ADR 0049) swaps in fakes that record "would send" / "would call"
 * instead. New actions add their effect here (ENG-7179 adds the HTTP call), and their executors
 * call it through `effects` rather than importing the transport.
 */
export interface WorkflowRunEffects {
  /** Sends one email; `false` when SMTP is not configured. Throws `TooManyRequestsError` when a cap is spent. */
  sendEmail: (input: Parameters<typeof sendEmail>[0]) => Promise<boolean>;
}

export const liveWorkflowRunEffects: WorkflowRunEffects = {
  sendEmail,
};
