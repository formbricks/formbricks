import { z } from "zod";
import { ZWorkflowRunLogResource, ZWorkflowRunResource } from "@formbricks/workflows";
import { isRecord } from "./redacted-result";

/** What a caller holds to read a workflow run's respondent-derived fields over MCP. */
export const RESPONSES_READ = [{ permission: "responses", level: "read" }] as const;

/**
 * A workflow run (`get_workflow_run`, `run_test`) without what is derived from respondents' answers:
 * the trigger payload, the run's data, each step's input and output, and the per-step summary (`steps`,
 * which repeats recipients, subjects, request and response bodies and errors), set to `null`. The run's and each step's error text
 * go too: a failed step's error can quote what it sent, such as an SMTP rejection naming the respondent's
 * address. For a caller without Responses: Read, whom the run's other fields (status, timing, step
 * order) don't tell anything a response says; a failed run still shows as failed. An error result passes
 * through.
 */
export const withoutRunRespondentData = (run: unknown): unknown =>
  isRecord(run)
    ? {
        ...run,
        error: null,
        triggerPayload: null,
        data: null,
        ...("steps" in run ? { steps: null } : {}),
        logs: Array.isArray(run.logs)
          ? run.logs.map((log: unknown) =>
              isRecord(log) ? { ...log, input: null, output: null, error: null } : log
            )
          : run.logs,
      }
    : run;

/**
 * A run as the MCP tools return it, for `outputSchema`: the fields `withoutRunRespondentData` empties
 * may be null. The SDK checks a result against the tool's `outputSchema`, so the plain run schema would
 * turn a redacted run into "Output validation error" for every caller without Responses: Read.
 */
export const ZMcpWorkflowRunOutput = ZWorkflowRunResource.extend({
  triggerPayload: ZWorkflowRunResource.shape.triggerPayload.nullable(),
  data: ZWorkflowRunResource.shape.data.nullable(),
  steps: ZWorkflowRunResource.shape.steps.nullable(),
  logs: z.array(
    ZWorkflowRunLogResource.extend({
      input: ZWorkflowRunLogResource.shape.input.nullable(),
      output: ZWorkflowRunLogResource.shape.output.nullable(),
    })
  ),
});
