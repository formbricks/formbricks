import { z } from "zod";
import { ZWorkflowSecretHeaderValue } from "../types/actions/http-request";

/**
 * Contracts for Replace on a secret header (ENG-7179, ADR 0043): a new value for one secret header of
 * an HTTP request step, written in place so the enabled workflow uses it from its next run.
 */

export const ZWorkflowSecretHeaderParams = z
  .object({
    workflowId: z.cuid2(),
    stepId: z.string().min(1).max(200).describe("The HTTP request step's id in the workflow definition."),
    headerName: z.string().min(1).max(256).describe("The secret header's name, matched case-insensitively."),
  })
  .strict();
export type TWorkflowSecretHeaderParams = z.infer<typeof ZWorkflowSecretHeaderParams>;

export const ZReplaceWorkflowSecretHeaderInput = z
  .object({
    value: ZWorkflowSecretHeaderValue.describe(
      "The new value, sent exactly as written. Stored encrypted and never returned."
    ),
  })
  .strict();
export type TReplaceWorkflowSecretHeaderInput = z.infer<typeof ZReplaceWorkflowSecretHeaderInput>;
