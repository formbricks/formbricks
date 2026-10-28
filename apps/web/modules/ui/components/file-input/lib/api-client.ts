import type { THeicConversionResource } from "@/app/api/internal/heic-conversions/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { toBase64 } from "@/modules/storage/file-upload";

/** A conversion sends the photo up and the JPEG back, so it gets longer than an ordinary write. */
const HEIC_CONVERSION_TIMEOUT_MS = 60_000;

const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

/**
 * Convert a HEIC photo to a JPEG on the server, named like the original with a `.jpg` extension. Throws a
 * `V3ApiError` when the server refuses it: too large, not a HEIC image, or too many conversions at once.
 */
export const convertHeicToJpeg = async (file: File): Promise<File> => {
  const dataUrl = String(await toBase64(file));
  const { image } = await sendApiRequest<THeicConversionResource>("/api/internal/heic-conversions", {
    method: "POST",
    body: { image: dataUrl.slice(dataUrl.indexOf(",") + 1) },
    timeoutMs: HEIC_CONVERSION_TIMEOUT_MS,
  });
  return new File([base64ToBytes(image)], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
};
