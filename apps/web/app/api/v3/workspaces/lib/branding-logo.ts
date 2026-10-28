import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { deleteFile, getSignedUrlForUpload } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

/** A brand logo is a small image; anything bigger is a photo or an attack, not a logo. */
export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_FETCH_TIMEOUT_MS = 10_000;

/**
 * png, jpeg and webp only. SVG is rejected rather than sanitised: it can carry script, and the logo is
 * served from the survey origin, so the safest rule is the shortest one.
 */
const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;
type TLogoMime = keyof typeof LOGO_TYPES;

/** The logo URL cannot be used. The message is fixed text written here, safe to relay to the caller. */
export class LogoImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoImageError";
  }
}

/** The logo was fine but the bucket did not take it: the caller's request is not at fault. */
export class LogoStorageError extends Error {
  constructor() {
    super("The logo could not be stored right now.");
    this.name = "LogoStorageError";
  }
}

export type TLogoImage = { bytes: Uint8Array; mime: TLogoMime; extension: string };

const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>, offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

/** The type the bytes really are, whatever the server claimed. */
const sniffMime = (bytes: Uint8Array): TLogoMime | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
};

const readCappedBody = async (response: Response): Promise<Uint8Array> => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LOGO_MAX_BYTES) {
    throw new LogoImageError("The logo is larger than 1 MB.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new LogoImageError("The logo URL returned no image.");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LOGO_MAX_BYTES) {
      await reader.cancel();
      throw new LogoImageError("The logo is larger than 1 MB.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/**
 * Download a logo from a public https URL.
 *
 * The same SSRF regime webhooks use: the URL is resolved and refused when any address is private or
 * internal, and the connection is pinned to the validated address so DNS cannot change between check
 * and connect. Redirects are not followed (a redirect target would skip the check), the body is read
 * through a hard size cap, and the bytes are sniffed so a mislabelled `Content-Type` cannot smuggle in
 * anything but png, jpeg or webp.
 */
export async function downloadLogoImage(url: string): Promise<TLogoImage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new LogoImageError("The logo URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new LogoImageError("The logo URL must be an https URL without credentials.");
  }

  let address: Awaited<ReturnType<typeof validateAndResolveWebhookUrl>>;
  try {
    address = await validateAndResolveWebhookUrl(url);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new LogoImageError("The logo URL must be a public address that can be resolved.");
    }
    throw error;
  }

  const dispatcher = address ? createPinnedDispatcher(address) : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { accept: Object.keys(LOGO_TYPES).join(", ") },
        signal: controller.signal,
        dispatcher,
      } as RequestInit);
    } catch {
      throw new LogoImageError("The logo URL could not be fetched.");
    }

    if (response.status >= 300 && response.status < 400) {
      throw new LogoImageError("The logo URL redirects. Use the final image URL.");
    }
    if (!response.ok) {
      throw new LogoImageError(`The logo URL answered with status ${response.status}.`);
    }

    const declaredType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!(declaredType in LOGO_TYPES)) {
      throw new LogoImageError("The logo must be a png, jpeg or webp image.");
    }

    let bytes: Uint8Array;
    try {
      bytes = await readCappedBody(response);
    } catch (error) {
      if (error instanceof LogoImageError) throw error;
      throw new LogoImageError("The logo URL could not be read.");
    }

    const mime = sniffMime(bytes);
    if (!mime || mime !== declaredType) {
      throw new LogoImageError("The logo must be a png, jpeg or webp image.");
    }

    return { bytes, mime, extension: LOGO_TYPES[mime] };
  } finally {
    clearTimeout(timeout);
    try {
      await dispatcher?.destroy();
    } catch (cleanupError) {
      logger.warn({ error: cleanupError }, "Failed to close the logo download connection");
    }
  }
}

/** Store the image under the workspace's public prefix and return the relative `/storage/...` url. */
export async function storeLogoImage(workspaceId: string, image: TLogoImage): Promise<string> {
  const signed = await getSignedUrlForUpload(
    `logo.${image.extension}`,
    workspaceId,
    image.mime,
    "public",
    LOGO_MAX_BYTES
  );
  if (!signed.ok) {
    logger.error({ workspaceId, error: signed.error }, "Could not sign the logo upload");
    throw new LogoStorageError();
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(signed.data.presignedFields)) {
    form.append(key, value);
  }
  // S3 requires the file to be the last field of a presigned POST.
  form.append("file", new Blob([image.bytes as BlobPart], { type: image.mime }));

  let uploaded: Response;
  try {
    uploaded = await fetch(signed.data.signedUrl, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error({ workspaceId, error }, "Logo upload to storage failed");
    throw new LogoStorageError();
  }
  if (!uploaded.ok) {
    logger.error({ workspaceId, statusCode: uploaded.status }, "Storage refused the logo upload");
    throw new LogoStorageError();
  }

  return signed.data.fileUrl;
}

/** Best-effort removal of a logo this call stored but then could not attach to the workspace. */
export async function discardStoredLogo(workspaceId: string, fileUrl: string): Promise<void> {
  try {
    const parsed = parseStorageFileUrl(fileUrl);
    if (!parsed || parsed.storageId !== workspaceId || parsed.accessType !== "public") return;
    await deleteFile(workspaceId, "public", decodeURIComponent(parsed.fileName));
  } catch (error) {
    logger.error({ workspaceId, error }, "Failed to discard an unattached logo");
  }
}
