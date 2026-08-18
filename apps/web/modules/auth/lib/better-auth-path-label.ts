import "server-only";

/**
 * Reduce a Better Auth request URL to a label that is safe to put in a Sentry tag and an application
 * log (ENG-2259).
 *
 * Why a labeller and not the raw path: Better Auth declares
 * `createAuthEndpoint("/reset-password/:token")`, so on that endpoint the password-reset token is a
 * PATH SEGMENT — and better-call resolves both `request.url` and `ctx.path` to the CONCRETE path, not
 * the route pattern (`better-call/dist/router.mjs:38` → `dist/context.mjs:20`). Emitting either would
 * write a live account-takeover credential into Sentry and the logs.
 *
 * The vocabulary is therefore derived from Better Auth's own endpoint registry rather than
 * hand-maintained: better-call stamps each endpoint function with its DECLARED path
 * (`better-call/dist/endpoint.mjs:56`), so every parameterized route arrives here containing `:` and
 * can never be matched verbatim by a concrete request. `/reset-password/<token>` degrades to
 * `reset-password`, and a token-bearing endpoint added by a future Better Auth upgrade is covered the
 * same way with no code change here — which is the point, since the version is not pinned forever.
 *
 * Full paths are kept where they carry diagnostic value: `/oauth2/userinfo`, `/oauth2/token` and
 * `/oauth2/authorize` stay distinct, and telling them apart is exactly what the ENG-2259 MCP-OAuth
 * lead needs. A first-segment-only scheme would collapse them into `oauth2`.
 *
 * The query string is never read. `/verify-email?token=…` and OAuth callbacks with `?code=&state=`
 * carry credentials there.
 */

// Deliberately a local copy of the literal in oauth-urls.ts rather than an import: that module reads
// `@/lib/env`, and pulling env validation into this one would cost it the property that makes it
// exhaustively testable — no dependencies, no environment. Both sites are grep-findable as
// "/api/auth" if the base path ever becomes configurable (ENG-606).
const AUTH_BASE_PATH = "/api/auth";

/** Emitted when the URL is unparseable or names no endpoint we serve. Bounds tag cardinality. */
export const UNKNOWN_AUTH_PATH_LABEL = "unknown";

const getFirstSegment = (path: string): string | undefined => path.split("/")[1] || undefined;

export const createAuthPathLabeller = (declaredPaths: Iterable<string>): ((url: string) => string) => {
  // Only parameter-free declared paths may be emitted verbatim. Patterns still contribute their first
  // segment, so `/reset-password/<token>` degrades to a recognized `reset-password` rather than to
  // `unknown` — the endpoint is still named, just not the secret in it.
  const literalPaths = new Set<string>();
  const knownFirstSegments = new Set<string>();

  for (const declaredPath of declaredPaths) {
    if (typeof declaredPath !== "string" || !declaredPath.startsWith("/")) continue;
    const firstSegment = getFirstSegment(declaredPath);
    if (firstSegment) knownFirstSegments.add(firstSegment);
    if (!declaredPath.includes(":")) literalPaths.add(declaredPath);
  }

  return (url: string): string => {
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return UNKNOWN_AUTH_PATH_LABEL;
    }

    // `indexOf` rather than `startsWith` so a Next.js basePath deployment (the app served from a
    // subpath) still resolves to the Better Auth path instead of labelling every request `unknown`.
    const baseIndex = pathname.indexOf(AUTH_BASE_PATH);
    if (baseIndex === -1) return UNKNOWN_AUTH_PATH_LABEL;

    const authPath = pathname.slice(baseIndex + AUTH_BASE_PATH.length);
    if (literalPaths.has(authPath)) return authPath;

    const firstSegment = getFirstSegment(authPath);
    if (firstSegment && knownFirstSegments.has(firstSegment)) return firstSegment;

    return UNKNOWN_AUTH_PATH_LABEL;
  };
};
