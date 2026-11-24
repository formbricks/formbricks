"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const useRunsViewSelection = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setUrl = useCallback(
    (next: { run?: string | null; step?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const showRun = useCallback((runId: string) => setUrl({ run: runId }), [setUrl]);
  const selectStep = useCallback((stepId: string | null) => setUrl({ step: stepId }), [setUrl]);

  return { urlRunId: searchParams.get("run"), selectedStepId: searchParams.get("step"), showRun, selectStep };
};
