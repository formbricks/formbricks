import { z } from "zod";
import { HEIC_CONVERSION_MAX_BASE64_LENGTH, HEIC_CONVERSION_MAX_IMAGE_BYTES } from "./lib/constants";

/** How many bytes a (valid, padded) base64 string decodes to, without decoding it. */
const decodedByteLength = (base64: string): number => {
  const padding = base64.endsWith("==") ? 2 : Number(base64.endsWith("="));
  return (base64.length / 4) * 3 - padding;
};

/** A HEIC image, base64-encoded, of at most `HEIC_CONVERSION_MAX_IMAGE_BYTES`. */
export const ZHeicConversionBody = z
  .object({
    image: z
      .base64()
      .min(1)
      .max(HEIC_CONVERSION_MAX_BASE64_LENGTH)
      .refine((image) => decodedByteLength(image) <= HEIC_CONVERSION_MAX_IMAGE_BYTES, {
        error: `Too big: expected the image to be at most ${HEIC_CONVERSION_MAX_IMAGE_BYTES} bytes`,
      }),
  })
  .strict();

export type THeicConversionBody = z.infer<typeof ZHeicConversionBody>;
