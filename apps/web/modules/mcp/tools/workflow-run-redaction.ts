import { isRecord } from "./redacted-result";

/** What a caller holds to read a workflow run's respondent-derived fields over MCP. */
export const RESPONSES_READ = [{ permission: "responses", level: "read" }] as const;

/**
 * A workflow run (`get_workflow_run`, `run_test`) without what is derived from respondents' answers:
 * the trigger payload, the run's data, and each step's input and output, set to `null`. The run's and each step's error text
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
        logs: Array.isArray(run.logs)
          ? run.logs.map((log: unknown) =>
              isRecord(log) ? { ...log, input: null, output: null, error: null } : log
            )
          : run.logs,
      }
    : run;
