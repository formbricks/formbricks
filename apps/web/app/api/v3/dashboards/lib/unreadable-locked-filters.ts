import "server-only";
import type { logger } from "@formbricks/logger";
import { problemInternalError } from "@/app/api/v3/lib/response";
import { UnreadableLockedFiltersError } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";

/**
 * The answer to a dashboard-bound read (chart data, a filter's value list) when the dashboard's stored
 * locked filters do not read: 500 naming the dashboard, logged as an error. Reading without the filter
 * would widen what readers see (ADR-0026), and no reader can fix it — an editor saving the dashboard's
 * filters again does. `null` for any other error.
 */
export const refuseUnreadableLockedFilters = (
  error: unknown,
  {
    dashboardId,
    log,
    requestId,
    instance,
  }: {
    dashboardId: string;
    log: Pick<ReturnType<typeof logger.withContext>, "error">;
    requestId: string;
    instance: string;
  }
): Response | null => {
  if (!(error instanceof UnreadableLockedFiltersError)) return null;
  log.error(
    { dashboardId, unreadable: error.unreadable },
    "A dashboard's stored locked filters could not be read; its read is refused"
  );
  return problemInternalError(
    requestId,
    `The locked filters of dashboard ${dashboardId} could not be read, so its charts are not read without them. An editor can save the dashboard's filters again.`,
    instance
  );
};
