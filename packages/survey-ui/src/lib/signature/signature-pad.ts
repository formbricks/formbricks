import { type SignatureContext2D, renderSignatureImage } from "./signature-draw";
import {
  MIN_POINT_DISTANCE,
  type SignatureContent,
  type SignatureMode,
  type SignaturePoint,
  type SignatureStroke,
  isTypedNameSigned,
  pointDistance,
  toNormalisedPoint,
} from "./signature-model";

/** The pointer-event fields the pad reads, so tests can dispatch plain objects. */
export interface PadPointerEvent {
  pointerId: number;
  clientX: number;
  clientY: number;
  /** 0 for the primary button; a mouse's other buttons never draw. */
  button?: number;
  pointerType?: string;
  preventDefault: () => void;
  getCoalescedEvents?: () => PadPointerEvent[];
}

type PadListener = (event: PadPointerEvent) => void;

export interface PadCanvas {
  width: number;
  height: number;
  addEventListener: (type: string, listener: PadListener) => void;
  removeEventListener: (type: string, listener: PadListener) => void;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  getContext: (
    contextId: "2d"
  ) => (SignatureContext2D & Pick<CanvasRenderingContext2D, "setTransform">) | null;
}

export interface SignaturePadContent {
  mode: SignatureMode;
  strokes: readonly SignatureStroke[];
  typedName: string;
}

export interface SignaturePadOptions {
  canvas: PadCanvas;
  /** Called with the full stroke list each time a stroke ends. */
  onStrokesChange: (strokes: SignatureStroke[]) => void;
  /** Device pixel ratio of the screen the pad is on. Defaults to `window.devicePixelRatio`. */
  getPixelRatio?: () => number;
  /** Calls back whenever the canvas changes size; returns a stop function. Defaults to `ResizeObserver`. */
  observeResize?: (callback: () => void) => () => void;
  /** Schedules a repaint. Defaults to `requestAnimationFrame`. */
  requestFrame?: (callback: () => void) => unknown;
}

export interface SignaturePad {
  /** Shows new content. Strokes this pad itself just reported are recognised and not re-applied. */
  setContent: (content: SignaturePadContent) => void;
  /** Whether pointers draw. Off in Type mode, while uploading and while disabled. */
  setDrawingEnabled: (enabled: boolean) => void;
  /** Repaints now, e.g. after the typed-name font finished loading. */
  redraw: () => void;
  destroy: () => void;
}

/** Widest backing store we allocate, and the most pixels in one: iOS refuses canvases past ~16.7 MP. */
export const MAX_BACKING_WIDTH = 4096;
export const MAX_BACKING_PIXELS = 16_000_000;

/**
 * The canvas backing-store size for a CSS size and the screen's pixel ratio, scaled down when the ideal
 * would pass the limits above (a huge card on a high-DPR screen). `scale` is the ratio actually used,
 * which the drawing transform has to match so strokes still fill the whole canvas.
 */
export const computeBackingSize = (
  cssWidth: number,
  cssHeight: number,
  ratio: number
): { width: number; height: number; scale: number } => {
  const scale = Math.min(
    ratio,
    MAX_BACKING_WIDTH / cssWidth,
    Math.sqrt(MAX_BACKING_PIXELS / (cssWidth * cssHeight))
  );
  return {
    width: Math.max(1, Math.floor(cssWidth * scale)),
    height: Math.max(1, Math.floor(cssHeight * scale)),
    scale,
  };
};

const defaultPixelRatio = (): number => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

const PEN_ERASER_BUTTON = 5;

const defaultObserveResize = (canvas: PadCanvas) => (callback: () => void) => {
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver(callback);
  observer.observe(canvas as unknown as Element);
  return () => observer.disconnect();
};

const defaultRequestFrame = (callback: () => void): unknown => {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  callback();
  return undefined;
};

/**
 * The drawing behaviour of the pad, separate from React: Pointer Events (touch, stylus and mouse) with
 * pointer capture, strokes stored in normalised 0-1 coordinates, a repaint on every size change so a
 * rotated or resized pad keeps its drawing, and a backing store sized for the screen's pixel ratio.
 *
 * Only one pointer draws at a time: a second finger landing mid-stroke is ignored, which keeps a palm
 * resting on the glass from adding marks.
 */
export const createSignaturePad = ({
  canvas,
  onStrokesChange,
  getPixelRatio = defaultPixelRatio,
  observeResize = defaultObserveResize(canvas),
  requestFrame = defaultRequestFrame,
}: SignaturePadOptions): SignaturePad => {
  let strokes: SignatureStroke[] = [];
  let lastReported: readonly SignatureStroke[] | null = null;
  let mode: SignatureMode = "draw";
  let typedName = "";
  let drawingEnabled = true;
  let active: { pointerId: number; points: SignaturePoint[] } | null = null;
  let framePending = false;
  let destroyed = false;

  const paint = (): void => {
    const rect = canvas.getBoundingClientRect();
    // A pad in a card that is not showing has no size; there is nothing to paint until it does.
    if (rect.width <= 0 || rect.height <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const backing = computeBackingSize(rect.width, rect.height, getPixelRatio());
    // Assigning width/height clears the canvas, so only do it when the size actually changed.
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    ctx.setTransform(backing.width / rect.width, 0, 0, backing.height / rect.height, 0, 0);

    let content: SignatureContent | null = null;
    if (mode === "type") {
      content = isTypedNameSigned(typedName) ? { kind: "name", name: typedName.trim() } : null;
    } else {
      const shown = active ? [...strokes, active.points] : strokes;
      content = shown.length > 0 ? { kind: "strokes", strokes: shown } : null;
    }
    renderSignatureImage(ctx, content, rect.width, rect.height);
  };

  const schedulePaint = (): void => {
    if (framePending || destroyed) return;
    framePending = true;
    requestFrame(() => {
      framePending = false;
      if (!destroyed) paint();
    });
  };

  const pointFor = (event: PadPointerEvent): SignaturePoint =>
    toNormalisedPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());

  const finishStroke = (): void => {
    if (!active) return;
    const { pointerId, points } = active;
    active = null;
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // The capture is already gone (the browser released it first); nothing to undo.
    }
    strokes = [...strokes, points];
    lastReported = strokes;
    onStrokesChange(strokes);
    schedulePaint();
  };

  const onPointerDown: PadListener = (event) => {
    if (!drawingEnabled || active) return;
    if (event.pointerType === "mouse" && event.button !== undefined && event.button !== 0) return;
    // The pen's eraser end reports button 5: it is for erasing, not for writing.
    if (event.button === PEN_ERASER_BUTTON) return;
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety (the stroke keeps following a finger that slides off the pad); drawing works without it.
    }
    active = { pointerId: event.pointerId, points: [pointFor(event)] };
    schedulePaint();
  };

  const onPointerMove: PadListener = (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length > 0 ? samples : [event]) {
      const point = pointFor(sample);
      if (pointDistance(active.points[active.points.length - 1], point) >= MIN_POINT_DISTANCE) {
        active.points.push(point);
      }
    }
    schedulePaint();
  };

  const onPointerEnd: PadListener = (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    finishStroke();
  };

  const events: [string, PadListener][] = [
    ["pointerdown", onPointerDown],
    ["pointermove", onPointerMove],
    ["pointerup", onPointerEnd],
    ["pointercancel", onPointerEnd],
    ["lostpointercapture", onPointerEnd],
  ];
  for (const [type, listener] of events) canvas.addEventListener(type, listener);

  const stopObserving = observeResize(schedulePaint);
  schedulePaint();

  return {
    setContent: (content) => {
      // The parent hands back the list this pad reported; adopting it again would only churn.
      if (content.strokes !== lastReported) {
        strokes = [...content.strokes];
        lastReported = null;
      }
      mode = content.mode;
      typedName = content.typedName;
      schedulePaint();
    },
    setDrawingEnabled: (enabled) => {
      drawingEnabled = enabled;
      if (!enabled) active = null;
    },
    redraw: paint,
    destroy: () => {
      destroyed = true;
      stopObserving();
      for (const [type, listener] of events) canvas.removeEventListener(type, listener);
    },
  };
};
