import { useEffect, useRef } from "react";
import type { TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { trackWorkflowEvent } from "../lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "../lib/analytics-events";

interface WorkflowListFilterState {
  isFilterInitialized: boolean;
  searchValue: string;
  debouncedSearchValue: string;
  selectedStatuses: TWorkflowStatus[];
  sortBy: TWorkflowSortBy;
}

/**
 * Reports one `workflow_list_filtered` per settled change of the list toolbar. Skips hydration
 * (stored filters are not a user action) and waits for the search debounce to catch up, so a stored
 * search value does not fire on load and typing fires once per pause rather than per keystroke.
 */
export const useTrackWorkflowListFilters = ({
  isFilterInitialized,
  searchValue,
  debouncedSearchValue,
  selectedStatuses,
  sortBy,
}: WorkflowListFilterState): void => {
  const hasSettledInitialFiltersRef = useRef(false);

  useEffect(() => {
    if (!isFilterInitialized || debouncedSearchValue !== searchValue) return;
    if (!hasSettledInitialFiltersRef.current) {
      hasSettledInitialFiltersRef.current = true;
      return;
    }
    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.listFiltered, {
      has_search: searchValue.trim().length > 0,
      status_filter: [...selectedStatuses].sort((a, b) => a.localeCompare(b)),
      sort_by: sortBy,
      includes_archived: selectedStatuses.includes("archived"),
    });
  }, [isFilterInitialized, searchValue, debouncedSearchValue, selectedStatuses, sortBy]);
};
