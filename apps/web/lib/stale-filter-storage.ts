import { removeLocalStorage } from "@/lib/localStorage";

/**
 * Surveys, Workflows and Creatives used to remember their filters in browser storage; since filters moved into
 * the URL (ADR 0015) nothing reads these keys, so they are removed the next time one of those lists opens.
 */
export const STALE_FILTER_STORAGE_KEYS = [
  "formbricks-surveys-filters",
  "formbricks-workflows-filters",
  "formbricks-creatives-filters",
];

/** Storage can be blocked (private mode, disabled site data); there is nothing to clean up then. */
export const removeStaleFilterStorage = () => {
  for (const key of STALE_FILTER_STORAGE_KEYS) removeLocalStorage(key);
};
