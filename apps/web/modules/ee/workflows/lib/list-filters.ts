import { z } from "zod";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { ZWorkflowSortBy, ZWorkflowStatus } from "@formbricks/workflows";

/**
 * Map the status-filter selection to the `statusIn` the list API expects. The API default-excludes
 * archived when `statusIn` is undefined, so an empty selection shows every live workflow and hides
 * archived. "archived" is just one more option in the filter: when it is selected it flows through
 * here and archived rows appear alongside any other selected statuses.
 */
export const computeStatusIn = (selectedStatuses: TWorkflowStatus[]): TWorkflowStatus[] | undefined =>
  selectedStatuses.length === 0 ? undefined : selectedStatuses;

/**
 * Toolbar filter state persisted to localStorage (mirrors the surveys list). Parsed defensively on
 * read: a malformed or stale payload returns null so the toolbar falls back to its defaults.
 */
const ZStoredWorkflowFilters = z.object({
  searchValue: z.string(),
  selectedStatuses: z.array(ZWorkflowStatus),
  sortBy: ZWorkflowSortBy,
});

export type TStoredWorkflowFilters = z.infer<typeof ZStoredWorkflowFilters>;

export const parseStoredWorkflowFilters = (raw: string | null): TStoredWorkflowFilters | null => {
  if (!raw) return null;
  try {
    const result = ZStoredWorkflowFilters.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};
