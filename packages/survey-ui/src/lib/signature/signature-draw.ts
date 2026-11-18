import type { SignatureContent, SignatureStroke } from "./signature-model";

/** The slice of the 2D canvas API the Signature element draws with, so tests can pass a recording fake. */
export type SignatureContext2D = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineCap"
  | "lineJoin"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "clearRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "quadraticCurveTo"
  | "arc"
  | "stroke"
  | "fill"
  | "fillText"
  | "measureText"
>;

/** The signature image is opaque white with near-black ink, whatever the survey's theme or appearance. */
export const SIGNATURE_PAPER_COLOR = "#ffffff";
export const SIGNATURE_INK_COLOR = "#111111";

/**
 * What a signature is painted with. `paper: null` leaves the background transparent, which is how the
 * on-screen pad lets the input background of the survey's theme show through.
 */
export interface SignaturePalette {
  paper: string | null;
  ink: string;
}

/** The exported PNG's colours: fixed, so every stored signature looks the same. */
export const SIGNATURE_EXPORT_PALETTE: SignaturePalette = {
  paper: SIGNATURE_PAPER_COLOR,
  ink: SIGNATURE_INK_COLOR,
};

/** The family the typed name is drawn in, with the system cursive font as the fallback. */
export const SIGNATURE_FONT_FAMILY = "Formbricks Signature Script";
export const SIGNATURE_FONT_STACK = `"${SIGNATURE_FONT_FAMILY}", cursive`;

/** Pen width as a fraction of the pad width, so the line looks the same on every pad size and in the PNG. */
const INK_WIDTH_RATIO = 0.005;
const MIN_INK_WIDTH = 2;

/** A typed name fills at most this much of the pad width and this much of its height. */
const TYPED_NAME_MAX_WIDTH_FRACTION = 0.9;
const TYPED_NAME_MAX_HEIGHT_FRACTION = 0.5;
const MIN_TYPED_FONT_SIZE = 8;
const FONT_MEASURE_REFERENCE_SIZE = 100;

export const inkWidthFor = (padWidth: number): number => Math.max(MIN_INK_WIDTH, padWidth * INK_WIDTH_RATIO);

/**
 * Draws strokes as smooth paths: each sampled point is a control point and the curve passes through the
 * midpoints between them (quadratic smoothing), which hides the jaggedness of pointer samples. A stroke
 * of one point is drawn as a dot.
 */
export const drawStrokes = (
  ctx: SignatureContext2D,
  strokes: readonly SignatureStroke[],
  width: number,
  height: number,
  ink: string = SIGNATURE_INK_COLOR
): void => {
  const lineWidth = inkWidthFor(width);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const px = (i: number): number => stroke[i].x * width;
    const py = (i: number): number => stroke[i].y * height;

    ctx.beginPath();
    if (stroke.length === 1) {
      ctx.arc(px(0), py(0), lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.moveTo(px(0), py(0));
    for (let i = 1; i < stroke.length - 1; i++) {
      ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    }
    ctx.lineTo(px(stroke.length - 1), py(stroke.length - 1));
    ctx.stroke();
  }
};

/**
 * The font size that makes a name fit the pad: as large as the height cap allows, shrunk when the name
 * is too wide. `widthAtReferenceSize` is the name's measured width at the reference size, and text
 * width scales linearly with font size.
 */
export const fitTypedNameFontSize = (
  widthAtReferenceSize: number,
  padWidth: number,
  padHeight: number
): number => {
  const heightCap = padHeight * TYPED_NAME_MAX_HEIGHT_FRACTION;
  if (!Number.isFinite(widthAtReferenceSize) || widthAtReferenceSize <= 0) return heightCap;
  const widthCap =
    (FONT_MEASURE_REFERENCE_SIZE * padWidth * TYPED_NAME_MAX_WIDTH_FRACTION) / widthAtReferenceSize;
  return Math.max(MIN_TYPED_FONT_SIZE, Math.min(heightCap, widthCap));
};

/** Draws a name centred on the pad, auto-fitted to it. The font must be loaded first to get the script face. */
export const drawTypedName = (
  ctx: SignatureContext2D,
  name: string,
  width: number,
  height: number,
  ink: string = SIGNATURE_INK_COLOR
): void => {
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${String(FONT_MEASURE_REFERENCE_SIZE)}px ${SIGNATURE_FONT_STACK}`;
  const size = fitTypedNameFontSize(ctx.measureText(name).width, width, height);
  ctx.font = `400 ${String(size)}px ${SIGNATURE_FONT_STACK}`;
  ctx.fillText(name, width / 2, height / 2);
};

/**
 * Paints the whole image: the page (opaque white for the PNG, cleared for the on-screen pad), then the
 * signature in the palette's ink (or nothing, for an unsigned pad).
 */
export const renderSignatureImage = (
  ctx: SignatureContext2D,
  content: SignatureContent | null,
  width: number,
  height: number,
  palette: SignaturePalette = SIGNATURE_EXPORT_PALETTE
): void => {
  if (palette.paper === null) {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, width, height);
  }
  if (!content) return;
  if (content.kind === "name") drawTypedName(ctx, content.name, width, height, palette.ink);
  else drawStrokes(ctx, content.strokes, width, height, palette.ink);
};
