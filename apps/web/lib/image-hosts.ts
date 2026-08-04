import { type StaticImageData } from "next/image";
import { LOOPBACK_HOSTS, OPTIMIZABLE_IMAGE_HOSTS } from "./optimizable-image-hosts.mjs";

// Re-exported from the plain `.mjs` source of truth (also imported by next.config.mjs) so
// remotePatterns and the runtime check below share one list. See ./optimizable-image-hosts.mjs.
export { OPTIMIZABLE_IMAGE_HOSTS };

const OPTIMIZABLE_IMAGE_HOSTS_SET: ReadonlySet<string> = new Set(OPTIMIZABLE_IMAGE_HOSTS);
const LOOPBACK_HOSTS_SET: ReadonlySet<string> = new Set(LOOPBACK_HOSTS);

// Must mirror the protocol `next.config.mjs` pins per host in `images.remotePatterns`: `http` for
// loopback hosts, `https` for every other allowlisted (public) host. Next.js matches `remotePatterns`
// protocol strictly, so a src whose protocol disagrees would be rejected by the optimizer even though
// its hostname is allowlisted.
const optimizableProtocolFor = (hostname: string): string =>
  LOOPBACK_HOSTS_SET.has(hostname) ? "http:" : "https:";

/**
 * Whether an `<Image>` src must be rendered with `unoptimized` because the Next.js image optimizer
 * would not (and should not) serve it.
 *
 * Returns `false` (i.e. optimize) for:
 * - relative paths (`/storage/...`, `/images/...`) — local images, optimized via `localPatterns`;
 * - `data:` URIs, `StaticImageData` imports, or empty/nullish values;
 * - absolute URLs whose host is in {@link OPTIMIZABLE_IMAGE_HOSTS} AND whose protocol matches what
 *   `next.config.mjs` generates for that host in `remotePatterns` (`http` for loopback, `https`
 *   otherwise).
 *
 * Returns `true` (i.e. bypass the optimizer, serve directly) for any other absolute `http(s)` URL —
 * i.e. arbitrary user-provided external images, or an allowlisted host requested over the "wrong"
 * protocol (which the optimizer would reject with a 400 anyway). This keeps the optimizer from acting
 * as an open proxy for hosts we don't control, without breaking rendering of those images.
 *
 * The decision depends only on the src string, so it is identical on the server and client (no
 * hydration mismatch).
 */
export const isExternalImageSrc = (src: string | StaticImageData | null | undefined): boolean => {
  if (!src || typeof src !== "string") return false;
  if (!/^https?:\/\//i.test(src)) return false; // relative path or data: URI → local/optimizable
  try {
    const url = new URL(src);
    const isOptimizableHost = OPTIMIZABLE_IMAGE_HOSTS_SET.has(url.hostname);
    const hasOptimizableProtocol = url.protocol === optimizableProtocolFor(url.hostname);
    return !(isOptimizableHost && hasOptimizableProtocol);
  } catch {
    return false;
  }
};
