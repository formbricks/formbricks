import { type SignatureContext2D, renderSignatureImage } from "./signature-draw";
import { type SignatureValue, resolveSignatureContent } from "./signature-model";

/** The exported PNG is always this size, whatever the device, pad size or pixel ratio. */
export const SIGNATURE_EXPORT_WIDTH = 900;
export const SIGNATURE_EXPORT_HEIGHT = 300;
export const SIGNATURE_PNG_FILE_NAME = "signature.png";
export const SIGNATURE_PNG_MIME_TYPE = "image/png";

export interface SignatureExportCanvas {
  width: number;
  height: number;
  getContext: (contextId: "2d") => SignatureContext2D | null;
  toDataURL: (type: string) => string;
}

export interface ExportSignatureOptions {
  /** Resolves once the typed-signature font can be drawn (or has failed); awaited only for typed names. */
  ensureTypedFont?: () => Promise<unknown>;
  /** Where the image is painted. Defaults to a detached `<canvas>`. */
  createCanvas?: () => SignatureExportCanvas;
}

const createDocumentCanvas = (): SignatureExportCanvas => document.createElement("canvas");

/**
 * Renders the signature to a 900 x 300 PNG and returns it as a data URL, or `null` when the value is
 * not signed. The image has an opaque white background and near-black ink. Drawn strokes are stored
 * as fractions of a pad that is always 3:1, so they scale onto the 3:1 image unchanged and the PNG shows
 * exactly what the respondent drew; a typed name is auto-fitted and centred.
 */
export const exportSignaturePng = async (
  value: SignatureValue,
  { ensureTypedFont, createCanvas = createDocumentCanvas }: ExportSignatureOptions = {}
): Promise<string | null> => {
  const content = resolveSignatureContent(value);
  if (!content) return null;

  if (content.kind === "name" && ensureTypedFont) {
    // A failed load is not an error here: the name is drawn in the system cursive font instead.
    await ensureTypedFont().catch(() => undefined);
  }

  const canvas = createCanvas();
  canvas.width = SIGNATURE_EXPORT_WIDTH;
  canvas.height = SIGNATURE_EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable");

  renderSignatureImage(ctx, content, SIGNATURE_EXPORT_WIDTH, SIGNATURE_EXPORT_HEIGHT);
  return canvas.toDataURL(SIGNATURE_PNG_MIME_TYPE);
};
