"use client";

import { useReactFlow } from "@xyflow/react";
import { type RefObject, useCallback, useEffect } from "react";
import { WORKFLOW_CANVAS_FIT_PADDING, getCanvasFitPadding } from "@/modules/ee/workflows/lib/canvas-fit";

// The canvas is the page's main action — let fitView scale small flows past the former 0.85 cap,
// which rendered a fresh two-node workflow noticeably small. 2x proved too big; 1.15 is three
// zoom-out steps down from it (RF's zoomIn/zoomOut step is 1.2x, and 2 / 1.2^3 ≈ 1.157).
export const WORKFLOW_CANVAS_MAX_ZOOM = 1.15;

// The inspector column animates its width over 150ms (see workflow-inspector-panel.tsx); move the
// view only after the canvas has its final size, with a small buffer.
const INSPECTOR_RESIZE_SETTLE_MS = 170;
// Panning a hidden step into view, and fitting on request (Fit to screen, Auto layout).
const REVEAL_PAN_MS = 170;
const FIT_MS = 300;
// How close to the canvas edge a step's card may sit before opening it pans it into view.
const REVEAL_MARGIN = 24;
// Frames to wait for a new step's card to be measured before panning to it.
const REVEAL_MEASURE_ATTEMPTS = 10;
/** How long a re-arranged flow takes to reach React Flow and be measured, before the view refits. */
const LAYOUT_REFIT_DELAY_MS = 120;

/** An animation's length, or none for people who ask for reduced motion (read when it starts). */
const motionMs = (ms: number): number =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;

/**
 * Where the canvas looks (ENG review of #10010): opening a step, or the panel, keeps the user's zoom
 * and only pans when the step's card would be hidden; the whole flow is fitted only on request (Fit
 * to screen, Auto layout, a new orientation).
 */
export const useCanvasViewport = ({
  canvasRef,
  openNodeId,
  isInspectorVisible,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  /** The step whose panel is open, null without one. */
  openNodeId: string | null;
  isInspectorVisible: boolean;
}) => {
  const { fitView, getInternalNode, getViewport, setCenter } = useReactFlow();

  // Fit the whole flow into the canvas.
  const refitViewport = useCallback(
    (duration: number) => {
      const canvas = canvasRef.current?.getBoundingClientRect();
      const padding = canvas
        ? getCanvasFitPadding({ canvasLeft: canvas.left, canvasRight: canvas.right, coverLeft: null })
        : WORKFLOW_CANVAS_FIT_PADDING;
      // Too little left visible to fit into: keep the current zoom and pan.
      if (padding === null) return;
      void fitView({ padding, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4, duration });
    },
    [canvasRef, fitView]
  );

  // Brings a step into view at the user's zoom: only when part of its card is outside the canvas
  // (behind the panel's edge, or a new step at the bottom), and only by panning.
  const revealNode = useCallback(
    (nodeId: string) => {
      const attempt = (attemptsLeft: number): void => {
        const node = getInternalNode(nodeId);
        const canvas = canvasRef.current?.getBoundingClientRect();
        if (!canvas) return;
        // A step that was just added isn't measured yet: try again on the next frames, so its whole
        // card, not just its corner, is what has to fit.
        if (!node?.measured.width) {
          if (attemptsLeft > 0) requestAnimationFrame(() => attempt(attemptsLeft - 1));
          return;
        }
        const { x, y, zoom } = getViewport();
        const width = node.measured.width;
        const height = node.measured.height ?? 0;
        const { x: nodeX, y: nodeY } = node.internals.positionAbsolute;
        const left = nodeX * zoom + x;
        const top = nodeY * zoom + y;
        const isInView =
          left >= REVEAL_MARGIN &&
          top >= REVEAL_MARGIN &&
          left + width * zoom <= canvas.width - REVEAL_MARGIN &&
          top + height * zoom <= canvas.height - REVEAL_MARGIN;
        if (isInView) return;
        void setCenter(nodeX + width / 2, nodeY + height / 2, { zoom, duration: motionMs(REVEAL_PAN_MS) });
      };
      attempt(REVEAL_MEASURE_ATTEMPTS);
    },
    [canvasRef, getInternalNode, getViewport, setCenter]
  );

  // Opening a step (a click, a new step) or opening/closing the panel: once the panel's width
  // transition settles, the open step is panned into view if the panel or the canvas edge hides it.
  useEffect(() => {
    if (!openNodeId) return;
    const timeoutHandle = setTimeout(() => revealNode(openNodeId), INSPECTOR_RESIZE_SETTLE_MS);
    return () => clearTimeout(timeoutHandle);
  }, [openNodeId, isInspectorVisible, revealNode]);

  const handleFitView = useCallback(() => refitViewport(motionMs(FIT_MS)), [refitViewport]);

  // Wait for new positions to reach React Flow (definition, then nodes, then their measured sizes)
  // before refitting; one frame is too early for a whole new orientation.
  const recenterAfterLayout = useCallback(() => {
    setTimeout(() => refitViewport(motionMs(FIT_MS)), LAYOUT_REFIT_DELAY_MS);
  }, [refitViewport]);
  const refitAfterLayout = useCallback(() => {
    setTimeout(() => refitViewport(0), LAYOUT_REFIT_DELAY_MS);
  }, [refitViewport]);

  return { handleFitView, recenterAfterLayout, refitAfterLayout };
};
