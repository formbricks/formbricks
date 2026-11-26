"use client";

import { useCallback, useState } from "react";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { GRID_MARGIN, ROW_HEIGHT } from "../lib/dashboard-grid-layout";
import { compactWidgetLayouts } from "../lib/saved-layout";
import { fitBlockHeights, pixelsToGridRows } from "../lib/widget-blocks";

/**
 * Auto-height of image and text blocks. Each block reports the pixels its content needs; that becomes the
 * fewest grid rows it takes (`fitBlockHeights`). Drawn always, saved with the edit.
 */
export const useBlockHeights = () => {
  const [neededRows, setNeededRows] = useState<ReadonlyMap<string, number>>(new Map());

  const handleMeasure = useCallback((widgetId: string, px: number) => {
    const rows = pixelsToGridRows(px, ROW_HEIGHT, GRID_MARGIN);
    setNeededRows((current) => {
      if (current.get(widgetId) === rows) return current;
      const next = new Map(current);
      next.set(widgetId, rows);
      return next;
    });
  }, []);

  /**
   * Every widget with the heights its blocks are drawn at and the places the grid draws them in, as the
   * save sends them: a block that grew pushes the ones below it down, as the grid's compactor does.
   */
  const withFittedHeights = useCallback(
    (all: TDashboardWidget[]) => compactWidgetLayouts(fitBlockHeights(all, neededRows)),
    [neededRows]
  );

  return { neededRows, handleMeasure, withFittedHeights };
};
