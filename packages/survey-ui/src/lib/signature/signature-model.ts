/**
 * The Signature element's value and the rules that read it. Pure data and arithmetic: nothing here
 * touches the DOM, a canvas or the network, so the "is it signed" decision is testable on its own.
 */

/** A point on the pad in normalised coordinates: `x` and `y` are 0-1 fractions of the pad's width and height. */
export interface SignaturePoint {
  x: number;
  y: number;
}

/** One pen-down to pen-up path. */
export type SignatureStroke = SignaturePoint[];

export type SignatureMode = "draw" | "type";

/**
 * Everything the respondent has entered. Both inputs are kept when the respondent switches between
 * Draw and Type, until Clear; `mode` says which one is showing.
 */
export interface SignatureValue {
  mode: SignatureMode;
  strokes: SignatureStroke[];
  typedName: string;
}

/** The pad is always three times as wide as it is tall, whatever the card width. */
export const SIGNATURE_ASPECT_RATIO = 3;

/**
 * The smallest stroke that counts as a signature, as a fraction of the pad's width (about 18 px on a
 * 600 px pad). A bare tap has length 0 and an accidental brush against the glass is a few pixels, so
 * neither makes the element "signed"; any deliberate mark is longer than this. A stroke must clear it
 * both as a path (its length) and as a shape (the diagonal of its bounding box), so a finger trembling
 * in place, which has length but no extent, does not count.
 */
export const MIN_STROKE_LENGTH = 0.03;

/** Samples closer together than this (fraction of the pad's width) add nothing to a stroke. */
export const MIN_POINT_DISTANCE = 0.0015;

export const TYPED_NAME_MAX_LENGTH = 60;

export const EMPTY_SIGNATURE: SignatureValue = { mode: "draw", strokes: [], typedName: "" };

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Converts a pointer position to normalised pad coordinates, clamped to the pad. */
export const toNormalisedPoint = (
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): SignaturePoint => {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height) };
};

/** Distance between two points in pad-width units, so a vertical move counts for what it measures on screen. */
export const pointDistance = (a: SignaturePoint, b: SignaturePoint): number =>
  Math.hypot(b.x - a.x, (b.y - a.y) / SIGNATURE_ASPECT_RATIO);

export const strokeLength = (stroke: SignatureStroke): number => {
  let length = 0;
  for (let i = 1; i < stroke.length; i++) length += pointDistance(stroke[i - 1], stroke[i]);
  return length;
};

/** Diagonal of the stroke's bounding box in pad-width units: how far the stroke actually reaches. */
export const strokeExtent = (stroke: SignatureStroke): number => {
  if (stroke.length === 0) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of stroke) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.hypot(maxX - minX, (maxY - minY) / SIGNATURE_ASPECT_RATIO);
};

export const isSignificantStroke = (stroke: SignatureStroke): boolean =>
  strokeLength(stroke) >= MIN_STROKE_LENGTH && strokeExtent(stroke) >= MIN_STROKE_LENGTH;

export const hasSignificantStroke = (strokes: readonly SignatureStroke[]): boolean =>
  strokes.some(isSignificantStroke);

/**
 * A typed name counts once it has at least one letter, number or symbol. Whitespace does not, and
 * neither do characters with no ink such as a zero-width space, which `trim()` leaves in place.
 */
export const isTypedNameSigned = (typedName: string): boolean => /[\p{L}\p{N}\p{S}]/u.test(typedName.trim());

/** Signed: a drawn stroke of minimum length, or a typed name with at least one letter, number or symbol, whichever mode is showing. */
export const isSignatureSigned = (value: SignatureValue): boolean =>
  hasSignificantStroke(value.strokes) || isTypedNameSigned(value.typedName);

/** The value after Clear: nothing drawn or typed, and the respondent stays in the mode they were in. */
export const clearSignature = (value: SignatureValue): SignatureValue => ({
  mode: value.mode,
  strokes: [],
  typedName: "",
});

export type SignatureContent =
  | { kind: "strokes"; strokes: SignatureStroke[] }
  | { kind: "name"; name: string };

/**
 * What the exported PNG shows. The mode the respondent is in wins when it holds a signature, so the
 * image matches the pad; if that mode is empty but the other one is signed, the other one is used,
 * because the element counts as signed. `null` when nothing is signed.
 */
export const resolveSignatureContent = (value: SignatureValue): SignatureContent | null => {
  const drawn = hasSignificantStroke(value.strokes);
  const typed = isTypedNameSigned(value.typedName);
  if (value.mode === "type" && typed) return { kind: "name", name: value.typedName.trim() };
  if (drawn) return { kind: "strokes", strokes: value.strokes };
  if (typed) return { kind: "name", name: value.typedName.trim() };
  return null;
};

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * A stable identity for what the PNG would show, or `null` when nothing is signed. Two values with the
 * same fingerprint export the same image, so the runtime can skip uploading it a second time.
 */
export const signatureFingerprint = (value: SignatureValue): string | null => {
  const content = resolveSignatureContent(value);
  if (!content) return null;
  if (content.kind === "name") return `name:${content.name}`;
  return `strokes:${content.strokes.map((stroke) => stroke.map((p) => `${round4(p.x)},${round4(p.y)}`).join(" ")).join("|")}`;
};

/**
 * What the element renders for its settings. With typed signatures off there is no Draw / Type toggle and
 * no name field, and the pad is always the drawing pad, whatever mode an earlier value was left in.
 */
export const getSignatureLayout = (
  allowTypedSignature: boolean,
  storedMode: SignatureMode
): { showModeToggle: boolean; mode: SignatureMode; showNameInput: boolean } => {
  const mode = allowTypedSignature ? storedMode : "draw";
  return { showModeToggle: allowTypedSignature, mode, showNameInput: mode === "type" };
};

/** The tab that arrow / Home / End keys move to, or `null` for a key that does not move the tab. */
export const nextSignatureMode = (
  key: string,
  current: SignatureMode,
  dir: "ltr" | "rtl"
): SignatureMode | null => {
  const order: SignatureMode[] = ["draw", "type"];
  const forwardKey = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const backKey = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  if (key === "Home") return order[0];
  if (key === "End") return order[order.length - 1];
  if (key === forwardKey || key === backKey) {
    const step = key === forwardKey ? 1 : -1;
    const index = order.indexOf(current);
    return order[(index + step + order.length) % order.length];
  }
  return null;
};
