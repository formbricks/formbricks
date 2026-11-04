import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import type { TResponse } from "@formbricks/types/responses";
import { reconcileFeedbackRecords } from "@/lib/feedback-source/reconcile";
import { getFeedbackSourcesBySurveyId } from "@/lib/feedback-source/service";
import { transformResponseToFeedbackRecords } from "@/lib/feedback-source/transform";
import { mapResponsePrismaToResponse, responseSelection } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { isSurveyOutboundAllowed } from "@/lib/survey/visibility/outbound";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { CLEANUP_SETTLE_MS } from "./constants";
import { type THubCallBudget, deleteHubRecords, isHubCallBudgetSpent } from "./hub-cleanup";

/** A claimed `hubResponseOutcome` row: one live response, and the Hub tenants that may hold its records. */
export type TOutcomeCleanupRow = {
  id: string;
  tenantIds: readonly string[];
  /** Exactly one id (the table's CHECK). */
  responseIds: readonly string[];
};

export type TOutcomeCleanupResult =
  | { status: "done" }
  /** Progress, not a failure: look again after `delayMs`. */
  | { status: "again"; delayMs: number }
  | { status: "failed"; error: string };

const DONE: TOutcomeCleanupResult = { status: "done" };
const AGAIN_AT_ONCE: TOutcomeCleanupResult = { status: "again", delayMs: 0 };

/**
 * How often one run re-reads the outcome and acts again because it changed under it. A reviewer flipping a
 * response faster than the Hub answers is rare; past this the row is left to the next run, not looped on.
 */
const MAX_ROUNDS = 3;

type TOutcome = TResponse["outcome"];

/** What a pass did, so the check afterwards knows which outcome it acted on. */
type TPass = { result: TOutcomeCleanupResult; actedOn: TOutcome | "gone" };

/** The survey and its sources, read once per run however many responses of it a batch holds. */
const createLookups = () => {
  const surveys = new Map<string, ReturnType<typeof getSurvey>>();
  const sources = new Map<string, ReturnType<typeof getFeedbackSourcesBySurveyId>>();
  return {
    survey: (surveyId: string) => {
      if (!surveys.has(surveyId)) surveys.set(surveyId, getSurvey(surveyId));
      return surveys.get(surveyId)!;
    },
    sources: (surveyId: string) => {
      if (!sources.has(surveyId)) sources.set(surveyId, getFeedbackSourcesBySurveyId(surveyId));
      return sources.get(surveyId)!;
    },
  };
};
type TLookups = ReturnType<typeof createLookups>;

const responseIdOf = (row: TOutcomeCleanupRow): string => row.responseIds[0] ?? "";

/** One query for every response of the batch, in the shape the live pipeline publishes from. */
const readResponses = async (ids: string[]): Promise<Map<string, TResponse>> => {
  const rows = await prisma.response.findMany({ where: { id: { in: ids } }, select: responseSelection });
  return new Map(rows.map((row) => [row.id, mapResponsePrismaToResponse(row)]));
};

/** Removing the records: one Hub cleanup for all of a survey's responses, not one per response. */
const removeRecords = async (
  surveyId: string,
  group: { row: TOutcomeCleanupRow; response: TResponse }[],
  budget: THubCallBudget
): Promise<TOutcomeCleanupResult> => {
  const result = await deleteHubRecords(
    {
      tenantIds: [...new Set(group.flatMap(({ row }) => row.tenantIds))],
      surveyId,
      responseIds: group.map(({ response }) => response.id),
    },
    budget
  );
  switch (result.status) {
    case "clean":
      return DONE;
    // Look once more after the settle time: a record on its way to the Hub can still land.
    case "deleted":
      return { status: "again", delayMs: CLEANUP_SETTLE_MS };
    case "budget":
      return AGAIN_AT_ONCE;
    case "failed":
      return { status: "failed", error: result.error };
  }
};

const isNotConfigured = (failures: { error: { status?: number; message?: string } }[]): boolean =>
  failures.every(
    ({ error }) => error.status === NO_CONFIG_ERROR.status && error.message === NO_CONFIG_ERROR.message
  );

const publishSource = async (
  response: TResponse,
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>,
  source: TFeedbackSourceWithMappings,
  budget: THubCallBudget
): Promise<TOutcomeCleanupResult | null> => {
  const records = transformResponseToFeedbackRecords(
    response,
    survey,
    source.formbricksMappings,
    source.feedbackDirectoryId
  );
  if (records.length === 0) return null;
  if (isHubCallBudgetSpent(budget)) return AGAIN_AT_ONCE;
  budget.remaining -= records.length;

  // Reconciling, not blind-creating: a record that is still there (a cleanup that had not run) is
  // corrected in place instead of failing as a duplicate.
  const { failures } = await reconcileFeedbackRecords(records, source.feedbackDirectoryId);
  if (failures.length === 0) return null;
  return {
    status: "failed",
    error: isNotConfigured(failures) ? "hubNotConfigured" : `hubReconcile:${failures[0]?.error.status ?? 0}`,
  };
};

/**
 * Rebuilding the records of a restored response, by the rule the live pipeline follows: only a finished
 * response, of a survey that is outbound-allowed, for each active feedback source.
 */
const rebuildRecords = async (
  response: TResponse,
  lookups: TLookups,
  budget: THubCallBudget
): Promise<TOutcomeCleanupResult> => {
  if (!response.finished) return DONE;
  const survey = await lookups.survey(response.surveyId);
  if (!survey || !isSurveyOutboundAllowed(survey)) return DONE;

  const sources = await lookups.sources(survey.id);
  try {
    for (const source of sources) {
      const stopped = await publishSource(response, survey, source, budget);
      if (stopped) return stopped;
    }
  } catch (error) {
    // A response that cannot be transformed would fail the same way on every retry; the live pipeline
    // and the historical import skip it too.
    logger.error(
      { err: error, responseId: response.id, surveyId: survey.id },
      "Outcome cleanup: transform failed"
    );
  }
  return DONE;
};

/** One pass over the rows against the outcome each response has right now. */
const runPass = async (
  rows: TOutcomeCleanupRow[],
  budget: THubCallBudget,
  lookups: TLookups
): Promise<Map<string, TPass>> => {
  const passes = new Map<string, TPass>();
  const responses = await readResponses(rows.map(responseIdOf));

  const removals = new Map<string, { row: TOutcomeCleanupRow; response: TResponse }[]>();
  const rebuilds: { row: TOutcomeCleanupRow; response: TResponse }[] = [];
  for (const row of rows) {
    const response = responses.get(responseIdOf(row));
    // Deleted since: the response's own deletion cleanup removes its records.
    if (!response) passes.set(row.id, { result: DONE, actedOn: "gone" });
    else if (response.outcome === "lowQuality") {
      removals.set(response.surveyId, [...(removals.get(response.surveyId) ?? []), { row, response }]);
    } else rebuilds.push({ row, response });
  }

  for (const [surveyId, group] of removals) {
    const result = await removeRecords(surveyId, group, budget);
    for (const { row, response } of group) passes.set(row.id, { result, actedOn: response.outcome });
  }
  for (const { row, response } of rebuilds) {
    const result = isHubCallBudgetSpent(budget)
      ? AGAIN_AT_ONCE
      : await rebuildRecords(response, lookups, budget);
    passes.set(row.id, { result, actedOn: response.outcome });
  }
  return passes;
};

/** The current outcome of each response that still exists. */
const readOutcomes = async (ids: string[]): Promise<Map<string, TOutcome>> => {
  const rows = await prisma.response.findMany({
    where: { id: { in: ids } },
    select: { id: true, outcome: true },
  });
  return new Map(rows.map((row) => [row.id, row.outcome]));
};

/**
 * Bring the Hub's records of each row's response in line with the response's CURRENT outcome: Low quality
 * removes them, anything else rebuilds them. The row says only which response to look at; what to do is read
 * from the database on every run, never from the row, so a mark and a restore in either order (or a row
 * that outlived the change that queued it) converge on the right state.
 *
 * Work is bounded by the batch, not multiplied by it: one read of all the responses, one survey and source
 * lookup per survey, one Hub cleanup per survey for the removals. A rebuild is one create per record, which
 * is the same cost as the live pipeline paying it.
 *
 * A change that lands while the Hub is being written to is caught by a second read of the outcome afterwards
 * and acted on within the same run, so the final state does not depend on which of two overlapping drains
 * finishes last. Never throws for a Hub failure: it is a `failed` result, retried with backoff.
 */
export const reconcileResponseOutcomes = async (
  rows: TOutcomeCleanupRow[],
  budget: THubCallBudget
): Promise<Map<string, TOutcomeCleanupResult>> => {
  const results = new Map<string, TOutcomeCleanupResult>();
  const lookups = createLookups();
  let pending = rows;

  for (let round = 0; round < MAX_ROUNDS && pending.length > 0; round++) {
    const passes = await runPass(pending, budget, lookups);
    const current = await readOutcomes(pending.map(responseIdOf));

    const changed: TOutcomeCleanupRow[] = [];
    for (const row of pending) {
      const pass = passes.get(row.id) as TPass;
      const moved =
        pass.actedOn !== "gone" &&
        current.has(responseIdOf(row)) &&
        current.get(responseIdOf(row)) !== pass.actedOn;
      if (moved && pass.result.status !== "failed") changed.push(row);
      else results.set(row.id, pass.result);
    }
    pending = changed;
  }

  // Still changing after the last round: the next run reads the outcome afresh.
  for (const row of pending) results.set(row.id, AGAIN_AT_ONCE);
  return results;
};
