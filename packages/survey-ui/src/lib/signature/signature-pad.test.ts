import { describe, expect, test, vi } from "vitest";
import { MIN_POINT_DISTANCE, type SignatureStroke, isSignatureSigned } from "./signature-model";
import {
  MAX_BACKING_PIXELS,
  MAX_BACKING_WIDTH,
  type PadCanvas,
  type PadPointerEvent,
  computeBackingSize,
  createSignaturePad,
} from "./signature-pad";

type Listener = (event: PadPointerEvent) => void;

/** A canvas that is a 300 x 100 CSS-pixel box at (10, 20); records the calls the pad makes on it. */
const createFakeCanvas = (size = { width: 300, height: 100 }) => {
  const listeners = new Map<string, Listener>();
  const ctxCalls: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    setTransform: vi.fn((...a: number[]) => ctxCalls.push(`setTransform ${a.join(",")}`)),
    fillRect: vi.fn(() => ctxCalls.push("fillRect")),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(() => ctxCalls.push("stroke")),
    fill: vi.fn(),
    fillText: vi.fn(() => ctxCalls.push("fillText")),
    measureText: vi.fn(() => ({ width: 100 })),
  };
  const rect = { left: 10, top: 20, ...size };
  const canvas = {
    width: 0,
    height: 0,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => rect,
    getContext: () => ctx,
  };
  const fire = (type: string, init: Partial<PadPointerEvent> & { pointerId?: number }) => {
    const event: PadPointerEvent = {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
      ...init,
    };
    listeners.get(type)?.(event);
    return event;
  };
  return { canvas: canvas as unknown as PadCanvas & typeof canvas, ctx, ctxCalls, listeners, fire, rect };
};

const setup = (overrides: { pixelRatio?: number; size?: { width: number; height: number } } = {}) => {
  const fake = createFakeCanvas(overrides.size);
  const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
  let resizeCallback: () => void = () => undefined;
  const stopObserving = vi.fn();
  const pad = createSignaturePad({
    canvas: fake.canvas,
    onStrokesChange,
    getPixelRatio: () => overrides.pixelRatio ?? 1,
    observeResize: (callback) => {
      resizeCallback = callback;
      return stopObserving;
    },
    requestFrame: (callback) => callback(),
  });
  return { ...fake, pad, onStrokesChange, resize: () => resizeCallback(), stopObserving };
};

// The pad is at (10, 20) and 300 x 100, so client (160, 70) is the centre.
const draw = (fake: ReturnType<typeof setup>, path: [number, number][], pointerId = 1) => {
  const [[firstX, firstY], ...rest] = path;
  fake.fire("pointerdown", { pointerId, clientX: firstX, clientY: firstY, pointerType: "touch", button: 0 });
  for (const [x, y] of rest) fake.fire("pointermove", { pointerId, clientX: x, clientY: y });
  const [lastX, lastY] = path[path.length - 1];
  fake.fire("pointerup", { pointerId, clientX: lastX, clientY: lastY });
};

describe("createSignaturePad drawing", () => {
  test("a finger stroke is reported in normalised 0-1 coordinates when it ends", () => {
    const fake = setup();
    draw(fake, [
      [10, 20],
      [160, 70],
      [310, 120],
    ]);
    expect(fake.onStrokesChange).toHaveBeenCalledTimes(1);
    expect(fake.onStrokesChange.mock.calls[0][0]).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
    ]);
  });

  test("captures the pointer and prevents the browser's own touch handling", () => {
    const fake = setup();
    const down = fake.fire("pointerdown", { pointerId: 7, clientX: 50, clientY: 50, pointerType: "touch" });
    expect(fake.canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(down.preventDefault).toHaveBeenCalled();
    fake.fire("pointerup", { pointerId: 7 });
    expect(fake.canvas.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  test("a bare tap is reported as a one-point stroke that does not count as signed", () => {
    const fake = setup();
    draw(fake, [[100, 60]]);
    const strokes = fake.onStrokesChange.mock.calls[0][0];
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toHaveLength(1);
    expect(isSignatureSigned({ mode: "draw", strokes, typedName: "" })).toBe(false);
  });

  test("a second finger landing mid-stroke is ignored", () => {
    const fake = setup();
    fake.fire("pointerdown", { pointerId: 1, clientX: 20, clientY: 30, pointerType: "touch" });
    fake.fire("pointerdown", { pointerId: 2, clientX: 200, clientY: 90, pointerType: "touch" });
    fake.fire("pointermove", { pointerId: 2, clientX: 250, clientY: 90 });
    fake.fire("pointermove", { pointerId: 1, clientX: 120, clientY: 30 });
    fake.fire("pointerup", { pointerId: 2 });
    expect(fake.onStrokesChange).not.toHaveBeenCalled();
    fake.fire("pointerup", { pointerId: 1 });
    const [stroke] = fake.onStrokesChange.mock.calls[0][0];
    expect(stroke).toHaveLength(2);
  });

  test("a mouse's secondary button does not draw", () => {
    const fake = setup();
    fake.fire("pointerdown", { clientX: 50, clientY: 50, pointerType: "mouse", button: 2 });
    fake.fire("pointerup", {});
    expect(fake.onStrokesChange).not.toHaveBeenCalled();
  });

  test("the pen's eraser end (button 5) does not draw, but its tip does", () => {
    const fake = setup();
    fake.fire("pointerdown", { clientX: 50, clientY: 50, pointerType: "pen", button: 5 });
    fake.fire("pointermove", { clientX: 150, clientY: 50 });
    fake.fire("pointerup", {});
    expect(fake.onStrokesChange).not.toHaveBeenCalled();

    fake.fire("pointerdown", { clientX: 50, clientY: 50, pointerType: "pen", button: 0 });
    fake.fire("pointermove", { clientX: 150, clientY: 50 });
    fake.fire("pointerup", {});
    expect(fake.onStrokesChange).toHaveBeenCalledTimes(1);
  });

  test("uses every coalesced sample of a move and drops samples closer than the minimum distance", () => {
    const fake = setup();
    fake.fire("pointerdown", { clientX: 10, clientY: 20, pointerType: "touch" });
    const sample = (x: number, y: number): PadPointerEvent => ({
      pointerId: 1,
      clientX: x,
      clientY: y,
      preventDefault: () => undefined,
    });
    fake.fire("pointermove", {
      clientX: 100,
      clientY: 20,
      getCoalescedEvents: () => [sample(40, 20), sample(40 + MIN_POINT_DISTANCE, 20), sample(100, 20)],
    });
    fake.fire("pointerup", {});
    expect(fake.onStrokesChange.mock.calls[0][0][0]).toHaveLength(3);
  });

  test("stops drawing when the browser takes the pointer away (scroll, system gesture)", () => {
    const fake = setup();
    fake.fire("pointerdown", { clientX: 20, clientY: 30, pointerType: "touch" });
    fake.fire("pointermove", { clientX: 120, clientY: 30 });
    fake.fire("pointercancel", {});
    expect(fake.onStrokesChange).toHaveBeenCalledTimes(1);
    // Capture is released by the browser afterwards; a stray event does not add a second stroke.
    fake.fire("lostpointercapture", {});
    expect(fake.onStrokesChange).toHaveBeenCalledTimes(1);
  });

  test("strokes accumulate across lifts", () => {
    const fake = setup();
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    draw(fake, [
      [20, 80],
      [120, 80],
    ]);
    expect(fake.onStrokesChange.mock.calls[1][0]).toHaveLength(2);
  });

  test("does not draw while drawing is disabled (Type mode, uploading, disabled)", () => {
    const fake = setup();
    fake.pad.setDrawingEnabled(false);
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    expect(fake.onStrokesChange).not.toHaveBeenCalled();
    fake.pad.setDrawingEnabled(true);
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    expect(fake.onStrokesChange).toHaveBeenCalledTimes(1);
  });
});

describe("createSignaturePad content and Clear", () => {
  test("adopts new strokes handed in by the parent, e.g. after Clear, and does not re-adopt its own echo", () => {
    const fake = setup();
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    const reported = fake.onStrokesChange.mock.calls[0][0];
    fake.pad.setContent({ mode: "draw", strokes: reported, typedName: "" });

    // A second stroke is appended to the pad's own list, not to a stale copy.
    draw(fake, [
      [20, 80],
      [120, 80],
    ]);
    expect(fake.onStrokesChange.mock.calls[1][0]).toHaveLength(2);

    // Clear: the parent hands back an empty list, and the next stroke starts from nothing.
    fake.pad.setContent({ mode: "draw", strokes: [], typedName: "" });
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    expect(fake.onStrokesChange.mock.calls[2][0]).toHaveLength(1);
  });

  test("restores strokes kept in memory (going back to the card) and draws on top of them", () => {
    const fake = setup();
    const kept: SignatureStroke[] = [
      [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    ];
    fake.pad.setContent({ mode: "draw", strokes: kept, typedName: "" });
    expect(fake.ctxCalls).toContain("stroke");
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    expect(fake.onStrokesChange.mock.calls[0][0]).toHaveLength(2);
  });

  test("shows the typed name in Type mode and the strokes in Draw mode", () => {
    const fake = setup();
    const strokes: SignatureStroke[] = [
      [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    ];
    fake.pad.setContent({ mode: "type", strokes, typedName: "Ada" });
    expect(fake.ctx.fillText).toHaveBeenCalled();
    expect(fake.ctx.stroke).not.toHaveBeenCalled();

    fake.pad.setContent({ mode: "draw", strokes, typedName: "Ada" });
    expect(fake.ctx.stroke).toHaveBeenCalled();
  });
});

describe("createSignaturePad sizing", () => {
  test("sizes the backing store for the device pixel ratio and scales the context to match", () => {
    const fake = setup({ pixelRatio: 2 });
    expect(fake.canvas.width).toBe(600);
    expect(fake.canvas.height).toBe(200);
    expect(fake.ctxCalls).toContain("setTransform 2,0,0,2,0,0");
  });

  test("repaints when the pad is resized or the tablet rotated, keeping the drawing", () => {
    const fake = setup();
    draw(fake, [
      [20, 30],
      [120, 30],
    ]);
    const strokesBefore = fake.ctx.stroke.mock.calls.length;

    fake.rect.width = 600;
    fake.rect.height = 200;
    fake.resize();

    expect(fake.canvas.width).toBe(600);
    expect(fake.ctx.stroke.mock.calls.length).toBeGreaterThan(strokesBefore);
    // The stroke is stored as fractions, so the next stroke on the bigger pad is in the same 0-1 space.
    draw(fake, [
      [10, 20],
      [610, 220],
    ]);
    expect(fake.onStrokesChange.mock.calls[1][0][1]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  test("paints nothing while the card is hidden and the pad has no size", () => {
    const fake = setup({ size: { width: 0, height: 0 } });
    expect(fake.ctx.fillRect).not.toHaveBeenCalled();
  });

  test("destroy removes the listeners and stops observing", () => {
    const fake = setup();
    fake.pad.destroy();
    expect(fake.listeners.size).toBe(0);
    expect(fake.stopObserving).toHaveBeenCalled();
  });
});

describe("computeBackingSize", () => {
  test("is the CSS size times the pixel ratio when that is small enough", () => {
    expect(computeBackingSize(684, 228, 2)).toEqual({ width: 1368, height: 456, scale: 2 });
  });

  test("never allocates a canvas wider than the width limit", () => {
    const size = computeBackingSize(3000, 1000, 3);
    expect(size.width).toBeLessThanOrEqual(MAX_BACKING_WIDTH);
    expect(size.scale).toBeLessThan(3);
    expect(size.width / size.height).toBeCloseTo(3, 1);
  });

  test("keeps the total pixel count under the iOS canvas limit", () => {
    const size = computeBackingSize(3800, 3800, 3);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_BACKING_PIXELS);
  });

  test("the pad uses the clamped size and a matching transform", () => {
    const fake = setup({ pixelRatio: 4, size: { width: 3000, height: 1000 } });
    expect(fake.canvas.width).toBeLessThanOrEqual(MAX_BACKING_WIDTH);
    const transform = fake.ctxCalls.find((call) => call.startsWith("setTransform"));
    expect(transform).toBeDefined();
    const scale = Number(transform?.split(" ")[1].split(",")[0]);
    expect(scale).toBeCloseTo(fake.canvas.width / 3000, 3);
  });
});
