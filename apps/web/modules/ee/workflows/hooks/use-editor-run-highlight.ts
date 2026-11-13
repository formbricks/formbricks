"use client";

import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useWorkflowRun } from "@/modules/ee/workflows/hooks/use-workflow-run";
import {
  type TRunCanvasHighlight,
  getRunCanvasHighlight,
} from "@/modules/ee/workflows/lib/run-canvas-highlight";
import { editorHighlightedRunIdAtom } from "@/modules/ee/workflows/state/run-drawer";

/**
 * The path of the run open in the editor's run drawer, for the canvas to mark (mock screen 7): null
 * while no run is shown. Reads the run from the query cache the Test run seeded.
 */
export const useEditorRunHighlight = (): TRunCanvasHighlight | null => {
  const runId = useAtomValue(editorHighlightedRunIdAtom);
  const { data: run } = useWorkflowRun({ runId, enabled: runId !== null });
  return useMemo(() => (runId ? getRunCanvasHighlight(run) : null), [runId, run]);
};
