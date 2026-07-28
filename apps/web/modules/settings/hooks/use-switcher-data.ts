"use client";

import { useCallback, useRef, useState } from "react";
import { logger } from "@formbricks/logger";
import { getFormattedErrorMessage } from "@/lib/utils/helper";

export interface SwitcherItem {
  id: string;
  name: string;
}

interface SwitcherActionResult {
  data?: SwitcherItem[];
  serverError?: string;
  validationErrors?: unknown;
}

// Shared loader for the organization / workspace switcher dropdowns. Centralizes the
// "load once when the dropdown opens -> sort by name -> surface a load error" logic that was
// otherwise copy-pasted across MainNavigation, the settings sidebar, the landing sidebar, and the
// breadcrumbs. Each consumer keeps its own render markup and navigation target; only the data
// concern is shared here.
export const useSwitcherData = (
  loader: () => Promise<SwitcherActionResult | undefined>,
  // Already-translated fallback message shown when the action returns no usable error.
  fallbackError: string,
  // Optional hook for consumers that want to log/report load failures (e.g. Sentry).
  onError?: (message: string) => void
) => {
  const [items, setItems] = useState<SwitcherItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once a load attempt has completed (success or failure) — lets consumers distinguish the
  // initial "never opened" state from "loaded, possibly empty".
  const [hasLoaded, setHasLoaded] = useState(false);

  // Synchronous guards to prevent duplicate fetches from rapid back-to-back calls
  const isLoadingRef = useRef(false);
  const hasDataRef = useRef(false);
  const hasErrorRef = useRef(false);

  // Hold the latest loader/onError in refs so callers can pass inline closures (e.g. ones that close
  // over organizationId) without memoizing them and without churning `load`'s identity every render.
  const loaderRef = useRef(loader);
  // eslint-disable-next-line react-hooks/refs -- migration ENG-1677
  loaderRef.current = loader;
  const onErrorRef = useRef(onError);
  // eslint-disable-next-line react-hooks/refs -- migration ENG-1677
  onErrorRef.current = onError;

  const load = useCallback(
    async (force = false) => {
      // Load once: skip if already populated, in flight, or currently showing an error (call retry()
      // to clear and reload). `force` bypasses the guard for explicit retries.
      if (!force && (hasDataRef.current || isLoadingRef.current || hasErrorRef.current)) return;
      isLoadingRef.current = true;
      hasErrorRef.current = false;
      setIsLoading(true);
      setError(null);
      try {
        const result = await loaderRef.current();
        if (result?.data) {
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setItems(sorted);
          hasDataRef.current = sorted.length > 0;
        } else {
          const message = (result ? getFormattedErrorMessage(result) : "") || fallbackError;
          setError(message);
          hasErrorRef.current = true;
          onErrorRef.current?.(message);
        }
      } catch (err) {
        // onError only receives the translated fallback message, so keep the raw error
        // detail in the log — it is the only place the original failure survives.
        logger.error(err, "Switcher data load failed");
        const message = fallbackError;
        setError(message);
        hasErrorRef.current = true;
        onErrorRef.current?.(message);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [fallbackError]
  );

  const retry = useCallback(() => {
    hasDataRef.current = false;
    hasErrorRef.current = false;
    void load(true);
  }, [load]);

  return { items, isLoading, error, hasLoaded, load, retry };
};
