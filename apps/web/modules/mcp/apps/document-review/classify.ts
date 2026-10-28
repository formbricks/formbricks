import { type TV3DocumentPushResult, ZV3DocumentPushResult } from "@/app/api/v3/documents/lib/envelope";
import type { TDestructiveChange } from "./diff";
import type { TDryRunOutcome } from "./review";

/** What a dry-run push answered: a review outcome, or a failure the tool reports as its own error. */
export type TClassifiedPush = { kind: "outcome"; outcome: TDryRunOutcome } | { kind: "error" };

type TProblemBody = {
  detail?: unknown;
  details?: unknown;
  invalid_params?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
};

const isDestructiveChange = (value: unknown): value is TDestructiveChange =>
  isRecord(value) && typeof value.type === "string";

const readIssues = (problem: TProblemBody): { name: string; reason: string }[] =>
  Array.isArray(problem.invalid_params)
    ? problem.invalid_params.flatMap((item: unknown) =>
        isRecord(item) && typeof item.name === "string" && typeof item.reason === "string"
          ? [{ name: item.name, reason: item.reason }]
          : []
      )
    : [];

/** The success half: the push result, or `undefined` when the body is not one (then it is an error). */
export const readPushResult = async (response: Response): Promise<TV3DocumentPushResult | undefined> => {
  if (!response.ok) return undefined;
  const body = await readJson(response);
  const parsed = ZV3DocumentPushResult.safeParse(isRecord(body) ? body.data : undefined);
  return parsed.success ? parsed.data : undefined;
};

/**
 * Sorts the answer of a dry-run push. A refusal that is about the document (stale, would remove data, not
 * valid) is a finding of the review, not a failure of the tool: the person still needs to see it. Anything
 * else (not authorised, not found, rate limited, a server fault) is the tool's own error.
 */
export const classifyDryRun = async (response: Response): Promise<TClassifiedPush> => {
  if (response.ok) {
    const result = await readPushResult(response);
    return result ? { kind: "outcome", outcome: { type: "ok", result } } : { kind: "error" };
  }

  if (response.status !== 409 && response.status !== 422) return { kind: "error" };

  const body = await readJson(response);
  const problem: TProblemBody = isRecord(body) ? body : {};
  const detail = typeof problem.detail === "string" ? problem.detail : "The push would be refused.";
  const details = isRecord(problem.details) ? problem.details : {};

  if (response.status === 409 && typeof details.currentUpdatedAt === "string") {
    return { kind: "outcome", outcome: { type: "stale", detail } };
  }

  if (response.status === 409 && details.reason === "destructive_change" && Array.isArray(details.changes)) {
    return {
      kind: "outcome",
      outcome: { type: "destructive", changes: details.changes.filter(isDestructiveChange) },
    };
  }

  return { kind: "outcome", outcome: { type: "invalid", detail, issues: readIssues(problem) } };
};
