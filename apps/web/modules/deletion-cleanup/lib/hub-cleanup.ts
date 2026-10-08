import "server-only";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { deleteFeedbackRecord, listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { isHubNotConfigured } from "@/modules/hub/utils";
import { HUB_CLEANUP_CONCURRENCY, HUB_CLEANUP_PAGE_SIZE } from "./constants";

/** The `source_type` the response pipeline writes survey records with (`feedback-source/transform.ts`). */
const SURVEY_SOURCE_TYPE = "formbricks_survey";

export type THubCleanupTarget = {
  tenantIds: readonly string[];
  surveyId: string;
  /** Only these responses' records; omitted for the whole survey. Never empty when given. */
  responseIds?: readonly string[];
};

/**
 * What a drain may still spend on the Hub: calls, and time (`deadline`, epoch ms). Shared by every row the
 * drain handles, and spent as calls are made, so one large survey can't hold the job worker past its run.
 */
export type THubCallBudget = { remaining: number; deadline: number };

export type THubCleanupResult =
  /** Every tenant listed nothing and nothing was deleted. */
  | { status: "clean" }
  /** Records were deleted, and every tenant then listed nothing. */
  | { status: "deleted"; count: number }
  /** The budget ran out first; what was deleted stays deleted. */
  | { status: "budget"; count: number }
  | { status: "failed"; error: string };

const HUB_NOT_FOUND = 404;

/** A listing plus a full page of deletes, so a page is never left half done for want of budget. */
const HUB_CALLS_PER_PAGE = 1 + HUB_CLEANUP_PAGE_SIZE;

/** Whether the budget can't cover another page, so the drain should leave Hub work to its next run. */
export const isHubCallBudgetSpent = (budget: THubCallBudget): boolean =>
  budget.remaining < HUB_CALLS_PER_PAGE || Date.now() >= budget.deadline;

/**
 * Whether a listed record is one this cleanup may delete. The Hub's delete takes a bare id and checks no
 * tenant (ENG-2058), so the listing's filters are the only boundary: re-check every one of them here, so a
 * filter the Hub ignored (a serialization slip, an SDK change) fails the cleanup instead of deleting
 * someone else's records.
 */
const isTargetRecord = (record: FeedbackRecordData, tenantId: string, target: THubCleanupTarget): boolean =>
  record.tenant_id === tenantId &&
  record.source_type === SURVEY_SOURCE_TYPE &&
  record.source_id === target.surveyId &&
  (!target.responseIds || target.responseIds.includes(record.submission_id));

/**
 * The first page of the target's records in one tenant, every one re-checked against the filters, or why
 * it can't be had.
 */
const listTenantPage = async (
  target: THubCleanupTarget,
  tenantId: string
): Promise<{ records: FeedbackRecordData[] } | { error: string }> => {
  const { data, error } = await listFeedbackRecords({
    tenant_id: tenantId,
    source_type: [SURVEY_SOURCE_TYPE],
    source_id: [target.surveyId],
    ...(target.responseIds ? { submission_id: [...target.responseIds] } : {}),
    limit: HUB_CLEANUP_PAGE_SIZE,
  });
  if (error || !data) {
    return {
      error: error && isHubNotConfigured(error) ? "hubNotConfigured" : `hubList:${error?.status ?? 0}`,
    };
  }
  if (!data.data.every((record) => isTargetRecord(record, tenantId, target)))
    return { error: "hubFilterMismatch" };
  return { records: data.data };
};

/** Delete one listed page. A 404 means the record is already gone, and counts as deleted. */
const deletePage = async (
  records: readonly FeedbackRecordData[]
): Promise<{ deleted: number; error: string | null; allAlreadyGone: boolean }> => {
  const results = await mapWithConcurrency(records, HUB_CLEANUP_CONCURRENCY, (record) =>
    deleteFeedbackRecord(record.id)
  );
  const failure = results.find((result) => result.error && result.error.status !== HUB_NOT_FOUND);
  return {
    deleted: results.filter((result) => !result.error || result.error.status === HUB_NOT_FOUND).length,
    error: failure?.error ? `hubDelete:${failure.error.status}` : null,
    allAlreadyGone: results.every((result) => result.error?.status === HUB_NOT_FOUND),
  };
};

/**
 * Delete a deleted survey's Hub records, or those of some of its deleted responses, in every given tenant.
 * Lists the first page and deletes it until a listing comes back empty: never pages with a cursor, since
 * the deletes move the pages under it.
 */
export const deleteHubRecords = async (
  target: THubCleanupTarget,
  budget: THubCallBudget
): Promise<THubCleanupResult> => {
  let count = 0;

  for (const tenantId of target.tenantIds) {
    for (;;) {
      if (isHubCallBudgetSpent(budget)) return { status: "budget", count };
      budget.remaining -= 1;

      const page = await listTenantPage(target, tenantId);
      if ("error" in page) return { status: "failed", error: page.error };
      if (page.records.length === 0) break;

      budget.remaining -= page.records.length;
      const outcome = await deletePage(page.records);
      count += outcome.deleted;
      if (outcome.error) return { status: "failed", error: outcome.error };
      // Every record listed was already gone: the listing is lagging behind the deletes. Re-listing at
      // once would spin through the budget on the same page, so leave it to the pass after the settle.
      if (outcome.allAlreadyGone) return { status: "deleted", count };
    }
  }

  return count > 0 ? { status: "deleted", count } : { status: "clean" };
};
