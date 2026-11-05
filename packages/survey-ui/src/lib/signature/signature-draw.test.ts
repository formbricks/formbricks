import { describe, expect, test } from "vitest";
import {
  SIGNATURE_FONT_STACK,
  SIGNATURE_INK_COLOR,
  SIGNATURE_PAPER_COLOR,
  type SignatureContext2D,
  drawStrokes,
  drawTypedName,
  fitTypedNameFontSize,
  inkWidthFor,
  renderSignatureImage,
} from "./signature-draw";

/**
 * A context that records its calls instead of painting. What it cannot show is whether the pixels look
 * right; that is covered by the browser check in the PR, not here.
 */
const createRecordingContext = (measuredWidth = 100) => {
  const calls: [string, ...number[]][] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect: (...a: number[]) => calls.push(["fillRect", ...a]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...a: number[]) => calls.push(["moveTo", ...a]),
    lineTo: (...a: number[]) => calls.push(["lineTo", ...a]),
    quadraticCurveTo: (...a: number[]) => calls.push(["quadraticCurveTo", ...a]),
    arc: (...a: number[]) => calls.push(["arc", ...a]),
    stroke: () => calls.push(["stroke"]),
    fill: () => calls.push(["fill"]),
    fillText: (_text: string, x: number, y: number) => calls.push(["fillText", x, y]),
    measureText: () => ({ width: measuredWidth }),
  };
  return { ctx: ctx as unknown as SignatureContext2D & typeof ctx, calls };
};

describe("drawStrokes", () => {
  test("draws a curve through the midpoints of three or more samples (quadratic smoothing)", () => {
    const { ctx, calls } = createRecordingContext();
    drawStrokes(
      ctx,
      [
        [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 1, y: 0 },
        ],
      ],
      300,
      100
    );
    expect(calls).toEqual([
      ["beginPath"],
      ["moveTo", 0, 0],
      // control point = the sample, end point = the midpoint to the next sample
      ["quadraticCurveTo", 150, 100, 225, 50],
      ["lineTo", 300, 0],
      ["stroke"],
    ]);
  });

  test("a two-point stroke is a straight line", () => {
    const { ctx, calls } = createRecordingContext();
    drawStrokes(
      ctx,
      [
        [
          { x: 0.1, y: 0.2 },
          { x: 0.9, y: 0.8 },
        ],
      ],
      300,
      100
    );
    expect(calls.map(([name]) => name)).toEqual(["beginPath", "moveTo", "lineTo", "stroke"]);
  });

  test("a one-point stroke is a dot, an empty stroke nothing", () => {
    const { ctx, calls } = createRecordingContext();
    drawStrokes(ctx, [[], [{ x: 0.5, y: 0.5 }]], 300, 100);
    expect(calls.map(([name]) => name)).toEqual(["beginPath", "arc", "fill"]);
    expect(calls[1].slice(1, 3)).toEqual([150, 50]);
  });

  test("uses near-black ink and a width that scales with the pad", () => {
    const { ctx } = createRecordingContext();
    drawStrokes(ctx, [], 900, 300);
    expect(ctx.strokeStyle).toBe(SIGNATURE_INK_COLOR);
    expect(ctx.lineWidth).toBe(inkWidthFor(900));
    expect(inkWidthFor(900)).toBeGreaterThan(inkWidthFor(300));
    expect(inkWidthFor(10)).toBeGreaterThanOrEqual(2);
  });
});

describe("fitTypedNameFontSize", () => {
  test("a short name is capped by the pad's height", () => {
    expect(fitTypedNameFontSize(100, 900, 300)).toBe(150);
  });

  test("a long name shrinks until it fits 90% of the pad width", () => {
    // 100px of this name is 4000px wide, so 900 * 0.9 = 810px needs a 20.25px font.
    expect(fitTypedNameFontSize(4000, 900, 300)).toBeCloseTo(20.25, 5);
  });

  test("never shrinks below a legible minimum", () => {
    expect(fitTypedNameFontSize(1_000_000, 900, 300)).toBe(8);
  });

  test("an unmeasurable name falls back to the height cap", () => {
    expect(fitTypedNameFontSize(0, 900, 300)).toBe(150);
    expect(fitTypedNameFontSize(Number.NaN, 900, 300)).toBe(150);
  });
});

describe("drawTypedName", () => {
  test("centres the name and sets the script font with the cursive fallback", () => {
    const { ctx, calls } = createRecordingContext(100);
    drawTypedName(ctx, "Ada", 900, 300);
    expect(ctx.textAlign).toBe("center");
    expect(ctx.textBaseline).toBe("middle");
    expect(ctx.font).toBe(`400 150px ${SIGNATURE_FONT_STACK}`);
    expect(calls).toEqual([["fillText", 450, 150]]);
  });
});

describe("renderSignatureImage", () => {
  test("always paints an opaque white page first", () => {
    const { ctx, calls } = createRecordingContext();
    renderSignatureImage(ctx, null, 900, 300);
    expect(ctx.fillStyle).toBe(SIGNATURE_PAPER_COLOR);
    expect(calls).toEqual([["fillRect", 0, 0, 900, 300]]);
  });

  test("draws strokes or a name on top of it", () => {
    const strokes = createRecordingContext();
    renderSignatureImage(strokes.ctx, { kind: "strokes", strokes: [[{ x: 0.5, y: 0.5 }]] }, 900, 300);
    expect(strokes.calls[0][0]).toBe("fillRect");
    expect(strokes.calls.some(([name]) => name === "arc")).toBe(true);

    const name = createRecordingContext();
    renderSignatureImage(name.ctx, { kind: "name", name: "Ada" }, 900, 300);
    expect(name.calls.some(([call]) => call === "fillText")).toBe(true);
  });
});
