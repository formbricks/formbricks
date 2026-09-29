"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TChartConfig } from "@formbricks/types/analysis";
import { isDeepEqual } from "@/lib/utils/object";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";

interface UseChartDirtyStateProps {
  open: boolean;
  /** Whether the dialog has settled: a saved chart has loaded, or a new one is ready to configure. */
  isReady: boolean;
  isSaving: boolean;
  chartName: string;
  chartData: AnalyticsResponse | null;
  chartConfig: TChartConfig;
}

/**
 * Whether the chart on screen differs from the one the dialog opened with, and the confirmation that
 * guards leaving with that difference unsaved.
 *
 * Dirty means *changed*, not merely populated. Opening a saved chart loads its data straight away, so
 * "has chart data" flagged every read-only visit as unsaved work — which is exactly what it used to
 * do. Instead this snapshots the state once the dialog has settled and compares against that: a new
 * chart starts from an empty snapshot, so generating or configuring anything counts.
 */
export function useChartDirtyState({
  open,
  isReady,
  isSaving,
  chartName,
  chartData,
  chartConfig,
}: Readonly<UseChartDirtyStateProps>) {
  const currentSnapshot = useMemo(
    () => ({
      name: chartName.trim(),
      type: chartData?.chartType ?? null,
      query: chartData?.query ?? null,
      config: chartConfig ?? null,
    }),
    [chartName, chartData, chartConfig]
  );

  // State rather than a ref: this is read during render to decide whether closing needs to ask.
  const [baseline, setBaseline] = useState<typeof currentSnapshot | null>(null);

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }
    if (isReady && baseline === null) {
      setBaseline(currentSnapshot);
    }
  }, [open, isReady, baseline, currentSnapshot]);

  const hasUnsavedChart = !isSaving && baseline !== null && !isDeepEqual(currentSnapshot, baseline);
  useBeforeUnloadPrompt(() => open && hasUnsavedChart);

  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  // What to run once the user confirms — closing and handing off to AI both discard the chart.
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);

  const confirmDiscard = useCallback(
    (action: () => void) => {
      if (!hasUnsavedChart) {
        action();
        return;
      }
      pendingDiscardActionRef.current = action;
      setIsConfirmingDiscard(true);
    },
    [hasUnsavedChart]
  );

  const runPendingDiscard = useCallback(() => {
    setIsConfirmingDiscard(false);
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    action?.();
  }, []);

  return {
    hasUnsavedChart,
    confirmDiscard,
    isConfirmingDiscard,
    setIsConfirmingDiscard,
    runPendingDiscard,
  };
}
