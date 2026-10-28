import { type Detail, htmlToPreviewText, humanizeKey, humanizeStepType, truncate } from "./describe";
import { formatDateTime, formatDuration } from "./format";
import type { RunDetail, RunStatus, RunStepLog, RunSummary, StepStatus } from "./model";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

interface StatusStyle {
  label: string;
  tone: Tone;
}

const RUN_STATUS: Record<RunStatus, StatusStyle> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  canceled: { label: "Canceled", tone: "neutral" },
};

const STEP_STATUS: Record<StepStatus, StatusStyle> = {
  pending: { label: "Pending", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  succeeded: { label: "Succeeded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};

export const getRunStatusStyle = (status: RunStatus): StatusStyle => RUN_STATUS[status];
export const getStepStatusStyle = (status: StepStatus): StatusStyle => STEP_STATUS[status];

/** Elapsed time between two ISO timestamps, or `null` while either is missing (or out of order). */
export const getElapsedMs = (startedAt: string | null, finishedAt: string | null): number | null => {
  if (!startedAt || !finishedAt) return null;
  const elapsed = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
};

/** "4.2 s" for a finished run, "Waiting to start" / "In progress" before that, nothing for a canceled one. */
export const describeRunDuration = (run: Pick<RunSummary, "status" | "startedAt" | "finishedAt">): string => {
  const elapsed = getElapsedMs(run.startedAt, run.finishedAt);
  if (elapsed !== null) return formatDuration(elapsed);
  if (run.status === "queued") return "Waiting to start";
  if (run.status === "running") return "In progress";
  return "No duration";
};

/** When the run started; a run that has not started yet is dated by when it was queued. */
export const describeRunStart = (
  run: Pick<RunSummary, "startedAt" | "createdAt">,
  locale?: string,
  timeZone?: string
): string =>
  run.startedAt
    ? formatDateTime(run.startedAt, locale, timeZone)
    : `Created ${formatDateTime(run.createdAt, locale, timeZone)}`;

const shortId = (id: string): string => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

/** What set the run off, in words: a test with sample data, or the survey response it processed. */
export const describeRunTrigger = (run: Pick<RunSummary, "isDryRun" | "responseId">): string => {
  if (run.isDryRun) return "Test run with sample data";
  return run.responseId ? `Survey response ${shortId(run.responseId)}` : "Survey response";
};

/** The failure to show under a run, kept short enough for a list row. */
export const describeRunFailure = (run: Pick<RunSummary, "status" | "error" | "attempt">): string | null => {
  if (run.status !== "failed" && !run.error) return null;
  const message = run.error ? truncate(run.error, 160) : "No failure message was recorded.";
  return run.attempt > 0 ? `${message} (attempt ${run.attempt + 1})` : message;
};

const MAX_IO_FIELDS = 6;
// An email body in a step's input is stored as HTML; show what a recipient would read. Named tags only,
// so a Message-ID such as <a1b2@example.com> is not mistaken for markup.
const HTML_MARKUP = /<\/?(p|br|div|span|b|i|u|strong|em|a|ul|ol|li|h[1-6])(\s[^<>]*)?\/?>/i;

/** A step's input or output as a few "key: value" lines. Long values and nested objects are cut short. */
export const summarizeRecord = (record: Record<string, unknown>): { details: Detail[]; hidden: number } => {
  const entries = Object.entries(record);
  const details = entries.slice(0, MAX_IO_FIELDS).map(([key, value]) => ({
    label: humanizeKey(key),
    value:
      typeof value === "string"
        ? HTML_MARKUP.test(value)
          ? htmlToPreviewText(value, 140)
          : truncate(value, 140)
        : typeof value === "number" || typeof value === "boolean" || value === null
          ? String(value)
          : truncate(JSON.stringify(value), 140),
  }));
  return { details, hidden: Math.max(0, entries.length - MAX_IO_FIELDS) };
};

export interface StepOutcome {
  id: string;
  name: string;
  status: StepStatus;
  duration: string | null;
  error: string | null;
  input: Detail[];
  output: Detail[];
  hiddenFields: number;
}

/** The run's step logs, in order, named after the workflow's own steps. */
export const buildStepOutcomes = (
  logs: readonly RunStepLog[],
  stepNames: ReadonlyMap<string, string>
): StepOutcome[] =>
  logs.map((log) => {
    const input = summarizeRecord(log.input);
    const output = summarizeRecord(log.output);
    const elapsed = getElapsedMs(log.startedAt, log.finishedAt);
    return {
      id: log.id,
      name: stepNames.get(log.stepId) ?? humanizeStepType(log.stepType),
      status: log.status,
      duration: elapsed === null ? null : formatDuration(elapsed),
      error: log.error ? truncate(log.error, 300) : null,
      input: input.details,
      output: output.details,
      hiddenFields: input.hidden + output.hidden,
    };
  });

/** What the trigger carried, without its content: ids and a count, never the respondent's answers. */
export const describeTriggerPayload = (run: RunDetail): Detail[] => {
  const details: Detail[] = [];
  if (run.responseId) details.push({ label: "Response", value: run.responseId });
  if (run.endingCardId) details.push({ label: "Ending card", value: run.endingCardId });
  details.push({
    label: "Answers carried",
    value: run.responseFieldCount === 0 ? "None" : String(run.responseFieldCount),
  });
  return details;
};

/** Counts for the section heading: "3 failed of 10 shown". */
export const summarizeRuns = (runs: readonly Pick<RunSummary, "status">[]): string => {
  if (runs.length === 0) return "No runs yet";
  const failed = runs.filter((run) => run.status === "failed").length;
  return failed === 0 ? `${runs.length} shown` : `${failed} failed of ${runs.length} shown`;
};
