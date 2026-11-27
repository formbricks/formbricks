import { normalizeCountryCode } from "@formbricks/types/responses";

/**
 * The country a new response records, for the public client ingest routes.
 *
 * A country the host set explicitly wins: a link survey's `?country=`, or `country` handed to
 * `setEmbeddedData` / `track({ hiddenFields })`, which the renderer sends as `meta.country`. The
 * survey owner knows something the CDN only guesses from the IP, and without this a self-hosted
 * instance with no CDN in front could never record a country at all. Only a two-letter code is kept.
 *
 * Without one, the CDN header: `CF-IPCountry` (Cloudflare), then `CloudFront-Viewer-Country` (AWS
 * CloudFront). Formbricks runs no GeoIP lookup of its own, so with neither the country stays unset.
 */
export const resolveResponseCountry = (clientCountry: unknown, requestHeaders: Headers): string | undefined =>
  normalizeCountryCode(clientCountry) ??
  (requestHeaders.get("CF-IPCountry") || requestHeaders.get("CloudFront-Viewer-Country") || undefined);
