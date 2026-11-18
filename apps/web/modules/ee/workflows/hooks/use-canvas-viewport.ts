"use client";

import { useReactFlow } from "@xyflow/react";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  TEST_RUN_DRAWER_SELECTOR,
  WORKFLOW_CANVAS_FIT_PADDING,
  getCanvasFitPadding,
} from "@/modules/ee/workflows/lib/canvas-fit";

// The canvas is the page's main action — let fitView scale small flows past the former 0.85 cap,
// which rendered a fresh two-node workflow noticeably small. 2x proved too big; 1.15 is three
// zoom-out steps down from it (RF's zoomIn/zoomOut step is 1.2x, and 2 / 1.2^3 ≈ 1.157).
export const WORKFLOW_CANVAS_MAX_ZOOM = 1.15;

// The inspector column animates its width over 150ms (see workflow-inspector-panel.tsx); move the
// view only after the canvas has its final size, with a small buffer.
const INSPECTOR_RESIZE_SETTLE_MS = 170;
// Near-instant: the refit for the Test run drawer should feel like part of opening it.
const DRAWER_REFIT_MS = INSPECTOR_RESIZE_SETTLE_MS / 4;
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
 * to screen, Auto layout, a new orientation) and when the Test run drawer opens or closes.
 */
export const useCanvasViewport = ({
  canvasRef,
  isRunDrawerOpen,
  openNodeId,
  isInspectorVisible,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  isRunDrawerOpen: boolean;
  /** The step whose panel is open, null without one. */
  openNodeId: string | null;
  isInspectorVisible: boolean;
}) => {
  const { fitView, getInternalNode, getViewport, setCenter } = useReactFlow();

  // Fit the flow into the part of the canvas that is not behind the Test run drawer, which slides
  // in over the canvas's right side without resizing it. The drawer is measured at call time, so a
  // narrow screen's full-width drawer counts too.
  const refitViewport = useCallback(
    (duration: number) => {
      const canvas = canvasRef.current?.getBoundingClientRect();
      let coverLeft: number | null = null;
      if (isRunDrawerOpen) {
        const drawerWidth =
          document.querySelector<HTMLElement>(TEST_RUN_DRAWER_SELECTOR)?.offsetWidth ?? window.innerWidth;
        coverLeft = window.innerWidth - drawerWidth;
      }
      const padding = canvas
        ? getCanvasFitPadding({ canvasLeft: canvas.left, canvasRight: canvas.right, coverLeft })
        : WORKFLOW_CANVAS_FIT_PADDING;
      // Too little left visible to fit into: keep the current zoom and pan.
      if (padding === null) return;
      void fitView({ padding, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4, duration });
    },
    [canvasRef, fitView, isRunDrawerOpen]
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

  // Opening or closing the Test run drawer fits the flow into the part of the canvas it leaves
  // visible, so the run's path can be read whole.
  const previousRunDrawerOpenRef = useRef(isRunDrawerOpen);
  useEffect(() => {
    if (previousRunDrawerOpenRef.current === isRunDrawerOpen) return;
    previousRunDrawerOpenRef.current = isRunDrawerOpen;
    const timeoutHandle = setTimeout(
      () => refitViewport(motionMs(DRAWER_REFIT_MS)),
      INSPECTOR_RESIZE_SETTLE_MS
    );
    return () => clearTimeout(timeoutHandle);
  }, [isRunDrawerOpen, refitViewport]);

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
