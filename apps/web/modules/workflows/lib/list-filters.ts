import { z } from "zod";
import type { TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { ZWorkflowSortBy, ZWorkflowStatus } from "@formbricks/workflows";

/**
 * Combine the status-filter selection with the Show-archived toggle into the `statusIn` the list API
 * expects. The API default-excludes archived when `statusIn` is undefined, so:
 * - filter empty + toggle off  -> undefined (API default excludes archived)
 * - filter empty + toggle on   -> all four statuses (archived included)
 * - filter set   + toggle off  -> the selected statuses
 * - filter set   + toggle on   -> the selected statuses plus archived
 *
 * The filter only exposes the live statuses (draft, enabled, disabled); archived is governed solely
 * by the toggle, so it is never part of `selectedStatuses`.
 */
export const computeStatusIn = (
  selectedStatuses: TWorkflowStatus[],
  showArchived: boolean
): TWorkflowStatus[] | undefined => {
  if (selectedStatuses.length === 0) {
    return showArchived ? [...ZWorkflowStatus.options] : undefined;
  }
  return showArchived ? [...selectedStatuses, "archived"] : selectedStatuses;
};

/**
 * Toolbar filter state persisted to localStorage (mirrors the surveys list). Parsed defensively on
 * read: a malformed or stale payload returns null so the toolbar falls back to its defaults.
 */
const ZStoredWorkflowFilters = z.object({
  searchValue: z.string(),
  selectedStatuses: z.array(ZWorkflowStatus),
  sortBy: ZWorkflowSortBy,
  showArchived: z.boolean(),
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
