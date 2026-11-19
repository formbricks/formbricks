"use client";

import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useWorkflowRun } from "@/modules/ee/workflows/hooks/use-workflow-run";
import {
  type TRunCanvasHighlight,
  getRunCanvasHighlight,
} from "@/modules/ee/workflows/lib/run-canvas-highlight";
import { canvasRunIdAtom } from "@/modules/ee/workflows/state/test-run";

/**
 * The path of the run a canvas marks (the Runs view sets it): null
 * while no run is shown. Reads the run from the query cache the Test run seeded.
 */
export const useEditorRunHighlight = (): TRunCanvasHighlight | null => {
  const runId = useAtomValue(canvasRunIdAtom);
  const { data: run } = useWorkflowRun({ runId, enabled: runId !== null });
  return useMemo(() => (runId ? getRunCanvasHighlight(run) : null), [runId, run]);
};
