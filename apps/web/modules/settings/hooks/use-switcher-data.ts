"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  fallbackErrorKey: string,
  // Optional hook for consumers that want to log/report load failures (e.g. Sentry).
  onError?: (message: string) => void
) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<SwitcherItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once a load attempt has completed (success or failure) — lets consumers distinguish the
  // initial "never opened" state from "loaded, possibly empty".
  const [hasLoaded, setHasLoaded] = useState(false);

  // Hold the latest loader/onError in refs so callers can pass inline closures (e.g. ones that close
  // over organizationId) without memoizing them and without churning `load`'s identity every render.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(
    async (force = false) => {
      // Load once: skip if already populated, in flight, or currently showing an error (call retry()
      // to clear and reload). `force` bypasses the guard for explicit retries.
      if (!force && (items.length > 0 || isLoading || error)) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await loaderRef.current();
        if (result?.data) {
          setItems([...result.data].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          const message = (result ? getFormattedErrorMessage(result) : "") || t(fallbackErrorKey);
          setError(message);
          onErrorRef.current?.(message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t(fallbackErrorKey);
        setError(message);
        onErrorRef.current?.(message);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [items.length, isLoading, error, fallbackErrorKey, t]
  );

  const retry = useCallback(() => {
    void load(true);
  }, [load]);

  return { items, isLoading, error, hasLoaded, load, retry };
};
