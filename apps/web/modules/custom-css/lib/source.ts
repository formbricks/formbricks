import type { TCustomCssInput, TCustomCssStored } from "@formbricks/types/custom-css";

/**
 * Editable source of a stored value: what API readers and editors see, and what a restore resubmits.
 * Pure and dependency-free so request-shape code (the v3 survey document) can use it without pulling in
 * the server-only save service. `null` when nothing is stored.
 */
export const toCustomCssSource = (stored: TCustomCssStored | null | undefined): TCustomCssInput | null => {
  if (!stored || (!stored.light && !stored.dark)) {
    return null;
  }
  return { light: stored.light?.source ?? null, dark: stored.dark?.source ?? null };
};
