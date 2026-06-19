import type { TWorkflowStatus } from "@formbricks/workflows";
import { ZWorkflowStatus } from "@formbricks/workflows";

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
