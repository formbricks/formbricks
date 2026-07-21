import { type StaticImageData } from "next/image";

/**
 * Hosts whose images are safe to run through the Next.js image optimizer (ENG-1678).
 *
 * Two hard constraints shape this list:
 * - `next.config` (and therefore `images.remotePatterns`) is frozen into the build. The same Docker
 *   image serves multiple domains (app.formbricks.com, ksa.formbricks.com, and every self-hoster),
 *   so the deployment's own domain can NOT be baked in here and is intentionally absent.
 * - First-party uploads are served from same-origin `/storage/...` (relative) paths, which Next
 *   treats as local images (governed by `localPatterns`, default: optimize all) — they never consult
 *   `remotePatterns`, so the running domain does not need to be listed.
 *
 * This list therefore contains only *universal* provider/CDN hosts that are identical on every
 * deployment. It is the single source of truth: `next.config.mjs` builds `images.remotePatterns`
 * from it, and `isExternalImageSrc` uses it to decide which `<Image>` srcs must be rendered
 * `unoptimized` (arbitrary user-provided external URLs) versus optimized.
 */
export const OPTIMIZABLE_IMAGE_HOSTS = [
  "avatars.githubusercontent.com",
  "avatars.slack-edge.com",
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "formbricks-cdn.s3.eu-central-1.amazonaws.com",
  // local development
  "localhost",
  "127.0.0.1",
] as const;

const OPTIMIZABLE_IMAGE_HOSTS_SET: ReadonlySet<string> = new Set(OPTIMIZABLE_IMAGE_HOSTS);

/**
 * Whether an `<Image>` src must be rendered with `unoptimized` because the Next.js image optimizer
 * would not (and should not) serve it.
 *
 * Returns `false` (i.e. optimize) for:
 * - relative paths (`/storage/...`, `/images/...`) — local images, optimized via `localPatterns`;
 * - `data:` URIs, `StaticImageData` imports, or empty/nullish values;
 * - absolute URLs whose host is in {@link OPTIMIZABLE_IMAGE_HOSTS}.
 *
 * Returns `true` (i.e. bypass the optimizer, serve directly) for any other absolute `http(s)` URL —
 * i.e. arbitrary user-provided external images. This keeps the optimizer from acting as an open
 * proxy for hosts we don't control, without breaking rendering of those images.
 *
 * The decision depends only on the src string, so it is identical on the server and client (no
 * hydration mismatch).
 */
export const isExternalImageSrc = (src: string | StaticImageData | null | undefined): boolean => {
  if (!src || typeof src !== "string") return false;
  if (!/^https?:\/\//i.test(src)) return false; // relative path or data: URI → local/optimizable
  try {
    return !OPTIMIZABLE_IMAGE_HOSTS_SET.has(new URL(src).hostname);
  } catch {
    return false;
  }
};
