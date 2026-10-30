import { describe, expect, test, vi } from "vitest";
import {
  SIGNATURE_EXPORT_HEIGHT,
  SIGNATURE_EXPORT_WIDTH,
  type SignatureExportCanvas,
  exportSignaturePng,
} from "./signature-export";
import { EMPTY_SIGNATURE, type SignatureValue } from "./signature-model";

const createFakeCanvas = () => {
  const painted: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect: vi.fn((..._: number[]) => painted.push("fillRect")),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(() => painted.push("fillText")),
    measureText: vi.fn(() => ({ width: 100 })),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn((type: string) => `data:${type};base64,AAAA`),
  };
  return { canvas: canvas as unknown as SignatureExportCanvas & typeof canvas, ctx, painted };
};

const drawn: SignatureValue = {
  ...EMPTY_SIGNATURE,
  strokes: [
    [
      { x: 0.1, y: 0.5 },
      { x: 0.8, y: 0.5 },
    ],
  ],
};

describe("exportSignaturePng", () => {
  test("renders every signature at exactly 900 x 300, whatever the pad was", async () => {
    const { canvas } = createFakeCanvas();
    const dataUrl = await exportSignaturePng(drawn, { createCanvas: () => canvas });
    expect(canvas.width).toBe(SIGNATURE_EXPORT_WIDTH);
    expect(canvas.height).toBe(SIGNATURE_EXPORT_HEIGHT);
    expect([canvas.width, canvas.height]).toEqual([900, 300]);
    expect(dataUrl).toBe("data:image/png;base64,AAAA");
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
  });

  test("paints the opaque white background before any ink", async () => {
    const { canvas, ctx, painted } = createFakeCanvas();
    await exportSignaturePng(drawn, { createCanvas: () => canvas });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 900, 300);
    expect(painted[0]).toBe("fillRect");
  });

  test("scales drawn strokes onto the 900 x 300 image by their normalised position", async () => {
    const { canvas, ctx } = createFakeCanvas();
    await exportSignaturePng(drawn, { createCanvas: () => canvas });
    expect(ctx.moveTo).toHaveBeenCalledWith(90, 150);
    expect(ctx.lineTo).toHaveBeenCalledWith(720, 150);
  });

  test("exports nothing for a value that is not signed", async () => {
    const { canvas } = createFakeCanvas();
    expect(await exportSignaturePng(EMPTY_SIGNATURE, { createCanvas: () => canvas })).toBeNull();
    expect(
      await exportSignaturePng(
        { ...EMPTY_SIGNATURE, strokes: [[{ x: 0.5, y: 0.5 }]], typedName: "   " },
        { createCanvas: () => canvas }
      )
    ).toBeNull();
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  test("waits for the typed-signature font before drawing a typed name", async () => {
    const { canvas, ctx } = createFakeCanvas();
    let release: () => void = () => undefined;
    const ensureTypedFont = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));

    const pending = exportSignaturePng(
      { ...EMPTY_SIGNATURE, mode: "type", typedName: "Ada" },
      { createCanvas: () => canvas, ensureTypedFont }
    );
    await Promise.resolve();
    expect(ctx.fillText).not.toHaveBeenCalled();

    release();
    await pending;
    expect(ctx.fillText).toHaveBeenCalledWith("Ada", 450, 150);
  });

  test("still draws the name when the font fails to load", async () => {
    const { canvas, ctx } = createFakeCanvas();
    await exportSignaturePng(
      { ...EMPTY_SIGNATURE, mode: "type", typedName: "Ada" },
      { createCanvas: () => canvas, ensureTypedFont: () => Promise.reject(new Error("offline")) }
    );
    expect(ctx.fillText).toHaveBeenCalled();
  });

  test("does not wait for the font when the image is drawn strokes", async () => {
    const { canvas } = createFakeCanvas();
    const ensureTypedFont = vi.fn(() => Promise.resolve());
    await exportSignaturePng(drawn, { createCanvas: () => canvas, ensureTypedFont });
    expect(ensureTypedFont).not.toHaveBeenCalled();
  });

  test("throws when the browser gives no 2D context, so an upload is never attempted with a blank image", async () => {
    const { canvas } = createFakeCanvas();
    canvas.getContext.mockReturnValueOnce(null as never);
    await expect(exportSignaturePng(drawn, { createCanvas: () => canvas })).rejects.toThrow(/2D context/);
  });
});
