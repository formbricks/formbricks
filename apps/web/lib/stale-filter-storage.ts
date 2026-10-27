/**
 * Surveys and Workflows used to remember their filters in browser storage; since filters moved into
 * the URL (ADR 0003) nothing reads these keys, so they are removed the next time either list opens.
 */
export const STALE_FILTER_STORAGE_KEYS = ["formbricks-surveys-filters", "formbricks-workflows-filters"];

export const removeStaleFilterStorage = (storage: Pick<Storage, "removeItem"> | undefined) => {
  try {
    for (const key of STALE_FILTER_STORAGE_KEYS) storage?.removeItem(key);
  } catch {
    // Storage can be blocked (private mode, disabled site data); there is nothing to clean up then.
  }
};
