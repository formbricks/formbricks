"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

const replaceSelection = (key: "run" | "step", value: string | null) => {
  // The Test run result and step clicks can arrive before Next publishes new search params.
  // Read the live URL and replace it synchronously so both updates survive.
  const url = new URL(globalThis.window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  globalThis.window.history.replaceState(null, "", url);
};

export const useRunsViewSelection = () => {
  const searchParams = useSearchParams();
  const showRun = useCallback((runId: string) => replaceSelection("run", runId), []);
  const selectStep = useCallback((stepId: string | null) => replaceSelection("step", stepId), []);

  return { urlRunId: searchParams.get("run"), selectedStepId: searchParams.get("step"), showRun, selectStep };
};
