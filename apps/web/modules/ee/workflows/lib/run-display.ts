import { type TWorkflowRunDetail } from "@/modules/ee/workflows/types";

export type TWorkflowRunLog = TWorkflowRunDetail["logs"][number];

// Cap on the characters rendered for a single run JSON blob (trigger payload, run data, step
// input/output). These columns are unbounded `Json`; past this size the pretty-printed string is
// truncated with a notice so one multi-MB payload can't blow up the DOM or the Prism highlight pass.
export const MAX_RUN_JSON_CHARS = 50_000;

// Render a single step's duration as a compact label; null when the step hasn't started/finished
// or the timestamps don't yield a sane, finite, non-negative elapsed value.
export const formatStepDuration = (startedAt: string | null, finishedAt: string | null): string | null => {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

export const hasKeys = (value: Record<string, unknown>): boolean => Object.keys(value).length > 0;

// Pretty-print a run JSON value for display, bounding the output length. Returns the full string
// when it fits; otherwise truncates and appends a notice with the true character count.
export const stringifyRunJson = (value: unknown, maxChars: number = MAX_RUN_JSON_CHARS): string => {
  const json = JSON.stringify(value, null, 2) ?? String(value);
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}\n\n… truncated — ${json.length} characters total`;
};
