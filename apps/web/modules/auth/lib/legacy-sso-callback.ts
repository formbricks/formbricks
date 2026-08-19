import "server-only";

/**
 * Keep serving the SSO callback URL that customer IdPs have had registered since v5.2, whatever path
 * the installed Better Auth actually mounts its handler on (ENG-2343).
 *
 * Better Auth has moved this path twice, neither time by our choice: the 1.6 `genericOAuth` plugin
 * mounted its own `/oauth2/callback/:providerId` route, and 1.7 rebuilt that plugin onto the built-in
 * `/callback/:id` route. Each move otherwise forces every self-hoster to re-register a redirect URI at
 * their IdP, which is the friction this module exists to end.
 *
 * The fix has two halves. `better-auth-providers.ts` pins `redirectURI` so Better Auth *advertises* the
 * v5.2 URL — but that option does not move the route the handler is mounted on, and it is an upstream
 * option we could lose. This half maps the advertised URL onto the path the installed version serves,
 * and it is entirely ours: no upstream release can take it away. So if the pin ever stops working, SSO
 * fails at the IdP with a `redirect_uri` mismatch (loud, and caught by
 * better-auth-redirect-uri-pin.test.ts at upgrade time) rather than half-working.
 *
 * Deliberately dependency-free — no env, no license, no `auth` import — so it is exhaustively testable
 * and so it works during the window where the provider list is empty (the generic providers are gated
 * behind `ENTERPRISE_LICENSE_KEY`).
 */

const AUTH_BASE_PATH = "/api/auth";
const LEGACY_CALLBACK_SEGMENT = `${AUTH_BASE_PATH}/oauth2/callback/`;
const CURRENT_CALLBACK_SEGMENT = `${AUTH_BASE_PATH}/callback/`;

/**
 * The generic-OAuth providers whose `redirectURI` is pinned to the legacy path. Kept as a local literal
 * rather than derived from `ssoGenericOAuthConfig`: that list is env- and license-gated and is empty on
 * an unlicensed instance, whereas this mapping must hold for any request that arrives. A test asserts
 * the two agree, so they cannot drift.
 *
 * Scoping to known ids is what keeps this safe: the oauth-provider plugin owns ~15 sibling `/oauth2/*`
 * routes (`/oauth2/consent`, `/oauth2/userinfo`, `/oauth2/token`, …) for our own MCP OAuth server, and
 * an unscoped prefix rewrite could shadow one that upstream adds later.
 */
export const PINNED_SSO_PROVIDER_IDS = ["azuread", "openid", "saml"] as const;

/**
 * The current-version URL for a legacy SSO callback request, or `null` when the request is not one.
 *
 * Matched as a SUFFIX, with the provider id exact and the prefix required to hold no second `/api/auth`.
 * Together those two conditions make this function's output a local invariant rather than something the
 * router has to clean up after: the only path it can ever produce is
 * `<basePath>/api/auth/callback/<pinned-id>`. A suffix rather than an anchored prefix because a Next.js
 * `basePath` deployment serves the app from a subpath, so the auth segment is not at position 0 — the
 * same reason `better-auth-path-label.ts` locates it with `indexOf` rather than `startsWith` (see
 * ENG-606); the single-auth-segment rule is what keeps that tolerance from also accepting a crafted
 * `/api/auth/x/api/auth/oauth2/callback/openid`. That one would be harmless anyway — the rewrite only ever
 * deletes an `/oauth2` segment, so it cannot reach an endpoint the caller could not already reach, and the
 * result 404s — but this runs inside the `/api/auth/*` catch-all, where "harmless because the router
 * rejects it" is a property worth owning here instead of inheriting.
 *
 * `/oauth2/callback/azuread/extra` and a trailing-slash form are both left alone: an IdP redirects to
 * precisely the URI it has registered, and an auth path is the wrong place to invent equivalences. Query
 * and fragment carry over untouched — the query is where `code` and `state` live.
 */
export const mapLegacySsoCallbackUrl = (requestUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  // Only http(s). On a cannot-be-a-base URL (`data:`, `mailto:`) the `pathname` setter is a silent no-op,
  // so the rewrite below would return the input unchanged — a non-rewrite escaping as a rewrite. Next
  // only ever hands us http(s), but this is an exported pure function whose docblock states an
  // unconditional invariant, so it should hold unconditionally.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const { pathname } = url;
  const providerId = PINNED_SSO_PROVIDER_IDS.find((id) =>
    pathname.endsWith(`${LEGACY_CALLBACK_SEGMENT}${id}`)
  );
  if (providerId === undefined) return null;

  const prefix = pathname.slice(0, pathname.length - (LEGACY_CALLBACK_SEGMENT.length + providerId.length));
  if (prefix.includes(`${AUTH_BASE_PATH}/`)) return null;

  url.pathname = `${prefix}${CURRENT_CALLBACK_SEGMENT}${providerId}`;
  return url.toString();
};

/**
 * The request Better Auth should handle: rewritten when it names a pinned legacy SSO callback, and the
 * original object otherwise (identity, so the common path allocates nothing).
 *
 * A rewrite rather than a redirect, so the single-use authorization `code` is not re-emitted in a
 * `Location` header on the GET callback that every one of our providers actually uses. Note this does not
 * hold for `response_mode=form_post`: Better Auth 1.7 itself 302s a POST callback to
 * `${baseURL}/callback/{id}?code=…&state=…` before validating state (`api/routes/callback.mjs`), so on
 * that path the code travels through a `Location` regardless of what we do here — which is also why the
 * body still has to be forwarded below rather than dropped.
 */
export const mapLegacySsoCallbackRequest = (request: Request): Request => {
  const mappedUrl = mapLegacySsoCallbackUrl(request.url);
  if (mappedUrl === null) return request;

  // GET/HEAD cannot carry a body; anything else (an IdP configured for `response_mode=form_post`)
  // forwards the stream, which undici requires `duplex: "half"` for. `duplex` is absent from TypeScript's
  // `RequestInit`, hence the cast.
  const forwardsBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(mappedUrl, {
    method: request.method,
    headers: request.headers,
    // Rebuilding a Request keeps nothing that is not copied. Without this a client disconnect stops
    // aborting `auth.handler` and its outbound IdP calls on the pinned path only — the pass-through path
    // returns the original object and does keep it, so omitting it gives the two paths different abort
    // behaviour.
    signal: request.signal,
    // `duplex` is absent from TypeScript's RequestInit; cast only that property so `method`, `headers`
    // and `body` above keep their checking.
    ...(forwardsBody ? { body: request.body, ...({ duplex: "half" } as RequestInit) } : {}),
  });
};
