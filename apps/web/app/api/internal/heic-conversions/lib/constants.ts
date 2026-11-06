import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";

/**
 * Limits of the HEIC conversion route. The image travels base64-encoded in a JSON body, so the byte
 * limit on the body is the encoded size of the largest image plus room for the envelope.
 */

/**
 * The largest HEIC image the route converts: 2 MiB, the body limit the server action it replaces had
 * (`serverActions.bodySizeLimit` in `next.config.mjs`).
 */
export const HEIC_CONVERSION_MAX_IMAGE_BYTES = DEFAULT_REQUEST_BODY_LIMIT_BYTES;

/** That image, base64-encoded: four characters for every three bytes, padded. */
export const HEIC_CONVERSION_MAX_BASE64_LENGTH = 4 * Math.ceil(HEIC_CONVERSION_MAX_IMAGE_BYTES / 3);

/** The body around it, `{"image":"…"}`, with room to spare; well below Next's 16 MB proxy limit. */
export const HEIC_CONVERSION_BODY_LIMIT_BYTES = HEIC_CONVERSION_MAX_BASE64_LENGTH + 1024;

/**
 * Conversions one server process runs at once. Decoding holds the whole bitmap in memory — about 48 MB
 * for a 12-megapixel phone photo — and runs on the event loop, so this bounds what a pod spends on them
 * when many users convert at the same time, which the per-user rate limit does not.
 */
export const HEIC_CONVERSION_MAX_IN_FLIGHT = 2;

/** Conversions one user runs at once on a server process: the dashboard converts files one by one. */
export const HEIC_CONVERSION_MAX_IN_FLIGHT_PER_USER = 1;

/** `Retry-After` when every slot is taken: a conversion takes a second or two. */
export const HEIC_CONVERSION_RETRY_AFTER_SECONDS = 5;

/** JPEG quality of the converted image, as before. */
export const HEIC_CONVERSION_JPEG_QUALITY = 0.9;
