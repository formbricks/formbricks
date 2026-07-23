/**
 * Hosts whose images are safe to run through the Next.js image optimizer (ENG-1678).
 *
 * Plain `.mjs` so `next.config.mjs` can statically import it at config-eval time (no jiti/TS needed)
 * while `lib/image-hosts.ts` re-exports it for the runtime `isExternalImageSrc` check — one source of
 * truth, so `images.remotePatterns` and the per-`<Image>` `unoptimized` decision can never drift.
 *
 * Two hard constraints shape this list:
 * - `next.config` (and therefore `remotePatterns`) is frozen into the build. The same Docker image
 *   serves multiple domains (app.formbricks.com, ksa.formbricks.com, and every self-hoster), so the
 *   deployment's own domain can NOT be baked in here and is intentionally absent.
 * - First-party uploads are served from same-origin `/storage/...` (relative) paths, which Next
 *   treats as local images (default: optimize all) and never checks against `remotePatterns`.
 *
 * It therefore contains only *universal* provider hosts that real features rely on and that are
 * identical on every deployment.
 */
export const OPTIMIZABLE_IMAGE_HOSTS = [
  // OAuth profile avatars
  "avatars.githubusercontent.com",
  "avatars.slack-edge.com",
  "lh3.googleusercontent.com",
  // survey editor's Unsplash background picker
  "images.unsplash.com",
  // local development
  "localhost",
  "127.0.0.1",
];
