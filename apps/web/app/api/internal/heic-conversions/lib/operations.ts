import "server-only";
import { logger } from "@formbricks/logger";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { THeicConversionBody } from "../schemas";
import { serializeHeicConversion } from "../serializers";
import { HEIC_CONVERSION_JPEG_QUALITY } from "./constants";

/**
 * `POST /api/internal/heic-conversions`: turn an iPhone photo (HEIC) into a JPEG the browser can show and
 * upload. Nothing is stored and nothing is read but the image, so any signed-in user may convert.
 */
export async function convertHeicToJpegOperation({
  body,
  requestId,
  instance,
}: {
  body: THeicConversionBody;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  // Loaded on first use: the decoder is large and only this route needs it.
  const convert = (await import("heic-convert")).default;

  let jpeg: ArrayBuffer;
  try {
    jpeg = await convert({
      // `heic-decode` reads the bytes by index, so it needs a typed array; `@types/heic-convert` says
      // ArrayBufferLike, which a bare ArrayBuffer satisfies and the decoder then rejects.
      buffer: Buffer.from(body.image, "base64") as unknown as ArrayBufferLike,
      format: "JPEG",
      quality: HEIC_CONVERSION_JPEG_QUALITY,
    });
  } catch (error) {
    logger.withContext({ requestId }).warn({ err: error }, "HEIC conversion failed");
    return problemUnprocessableContent(requestId, "The image is not a HEIC image that can be converted.", {
      instance,
    });
  }

  return successResponse(serializeHeicConversion(jpeg), { requestId });
}
