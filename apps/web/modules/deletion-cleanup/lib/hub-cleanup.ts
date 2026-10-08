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

/** Hub calls a drain may still make. Shared by every row the drain handles, and spent as calls are made. */
export type THubCallBudget = { remaining: number };

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
  budget.remaining < HUB_CALLS_PER_PAGE;

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
 * Delete a deleted survey's Hub records, or those of some of its deleted responses, in every given tenant.
 * Lists the first page and deletes it until a listing comes back empty: never pages with a cursor, since
 * the deletes move the pages under it. A 404 on delete means the record is already gone.
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

      const { data, error } = await listFeedbackRecords({
        tenant_id: tenantId,
        source_type: [SURVEY_SOURCE_TYPE],
        source_id: [target.surveyId],
        ...(target.responseIds ? { submission_id: [...target.responseIds] } : {}),
        limit: HUB_CLEANUP_PAGE_SIZE,
      });
      if (error || !data) {
        return {
          status: "failed",
          error: error && isHubNotConfigured(error) ? "hubNotConfigured" : `hubList:${error?.status ?? 0}`,
        };
      }
      if (data.data.length === 0) break;
      if (!data.data.every((record) => isTargetRecord(record, tenantId, target))) {
        return { status: "failed", error: "hubFilterMismatch" };
      }

      budget.remaining -= data.data.length;
      const results = await mapWithConcurrency(data.data, HUB_CLEANUP_CONCURRENCY, (record) =>
        deleteFeedbackRecord(record.id)
      );
      const failures = results.filter((result) => result.error && result.error.status !== HUB_NOT_FOUND);
      count += results.length - failures.length;
      if (failures[0]?.error) return { status: "failed", error: `hubDelete:${failures[0].error.status}` };
    }
  }

  return count > 0 ? { status: "deleted", count } : { status: "clean" };
};
