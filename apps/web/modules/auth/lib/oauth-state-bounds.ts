import { APIError } from "better-auth/api";

/**
 * Largest callback URL (`callbackURL`, `errorCallbackURL`, `newUserCallbackURL`) a sign-in may carry, in
 * UTF-8 bytes (ENG-6885).
 *
 * Starting an OAuth sign-in is anonymous, and Better Auth keeps these URLs in the OAuth state record, in
 * Redis, for its 10-minute lifetime. Bounded only by the 256 KiB body limit, one request could park a
 * quarter of a megabyte there, and Redis runs with `noeviction`, so filling it stops sessions, rate
 * limits and caches for everyone. The longest honest value is the login page's return URL carrying an
 * invite token (about 1.5 KB); 8 KiB leaves five times that, matching the request-line limit common
 * servers and proxies apply to a URL anyway.
 */
export const OAUTH_CALLBACK_URL_MAX_BYTES = 8 * 1024;

/**
 * Largest signed `oauth_query` a sign-in may carry, in UTF-8 bytes (ENG-6885).
 *
 * An MCP client's authorize request reaches the login page signed, and the sign-in sends it back;
 * oauth-provider stores it in the state record as `serverContext`. The signature proves the server issued
 * it, not that it is small: `/oauth2/authorize` signs whatever parameters an anonymous caller sent, after
 * registering a client through open DCR. An honest query (client id, one redirect URI, scopes, PKCE
 * challenge, resource, state, signature) is well under 2 KB; 16 KiB leaves room for a redirect URI and a
 * `state` at the callback-URL cap each.
 */
export const OAUTH_QUERY_MAX_BYTES = 16 * 1024;

/**
 * Largest `/oauth2/authorize` request, measured as the UTF-8 bytes of its parameter names and values (ENG-7396).
 *
 * Once a user has consented to a client, every authorize call issues a code, and oauth-provider stores
 * the code with the whole request in Redis for 10 minutes. Its schema caps no string and passes unknown
 * keys through, so the bound is on the request as a whole, not per field. An honest request is under 1 KB.
 * Half of {@link OAUTH_QUERY_MAX_BYTES}, because the login and consent pages get this request back signed,
 * with its parameter names repeated and a signature added, and must still be able to send it on.
 */
export const OAUTH_AUTHORIZE_PARAMS_MAX_BYTES = 8 * 1024;

const CALLBACK_URL_FIELDS = ["callbackURL", "errorCallbackURL", "newUserCallbackURL"] as const;

// Every route that writes a state record from the request body (`generateState`). `/link-social` needs a
// session and is closed over HTTP elsewhere, but `hooks.before` also runs for in-process calls.
const STATE_WRITING_PATHS = new Set(["/sign-in/social", "/link-social"]);

const AUTHORIZE_PATH = "/oauth2/authorize";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const refuse = (message: string, oauthError = false): never => {
  // An OAuth client reads `error` / `error_description` (RFC 6749 §4.1.2.1); Better Auth's own client reads
  // `code` / `message`.
  throw new APIError("BAD_REQUEST", {
    message,
    code: "VALIDATION_ERROR",
    ...(oauthError ? { error: "invalid_request", error_description: message } : {}),
  });
};

const refuseOver = (body: Record<string, unknown>, field: string, maxBytes: number): void => {
  const value = body[field];
  if (typeof value === "string" && Buffer.byteLength(value, "utf8") > maxBytes) {
    refuse(`${field} must not exceed ${maxBytes} bytes`);
  }
};

/** UTF-8 bytes of a request's parameter names and values; a non-string value counts as its JSON. */
const paramBytes = (params: unknown): number => {
  if (params === undefined || params === null) return 0;
  if (!isRecord(params)) return Buffer.byteLength(String(params), "utf8");
  let bytes = 0;
  for (const [name, value] of Object.entries(params)) {
    const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "");
    bytes += Buffer.byteLength(name, "utf8") + Buffer.byteLength(text, "utf8");
  }
  return bytes;
};

/**
 * Before-hook that bounds what an OAuth request can make Better Auth store in Redis (ENG-6885, ENG-7396).
 * It runs before the endpoint and before oauth-provider's own hook, so a refused request writes nothing.
 *
 * - `/sign-in/social`, `/link-social` (the OAuth state record, ENG-6885): `additionalData` is refused
 *   outright, since Better Auth spreads it into the record unbounded and Formbricks never sends it. Each
 *   callback URL is capped at {@link OAUTH_CALLBACK_URL_MAX_BYTES}; one of the wrong type is left to the
 *   endpoint's schema, which refuses it before the record is written.
 * - `/oauth2/authorize` (the authorization-code record, ENG-7396): the request's parameters, query and body
 *   together, are capped at {@link OAUTH_AUTHORIZE_PARAMS_MAX_BYTES}.
 * - A signed `oauth_query`, on any path: the sign-in, consent and continue routes all replay it into one of
 *   those records. It is capped at {@link OAUTH_QUERY_MAX_BYTES}, and anything but a string is refused:
 *   oauth-provider's hook reads any truthy value with `new URLSearchParams`, which also takes key/value
 *   pairs or a record, and the signature still verifies, so the cap could otherwise be sidestepped.
 */
export const boundOAuthStateBeforeHandler = (ctx: {
  path: string;
  body?: unknown;
  query?: unknown;
}): void => {
  const body = isRecord(ctx.body) ? ctx.body : undefined;

  if (body?.oauth_query !== undefined) {
    if (typeof body.oauth_query !== "string") refuse("oauth_query must be a string");
    refuseOver(body, "oauth_query", OAUTH_QUERY_MAX_BYTES);
  }

  if (
    ctx.path === AUTHORIZE_PATH &&
    paramBytes(ctx.query) + paramBytes(ctx.body) > OAUTH_AUTHORIZE_PARAMS_MAX_BYTES
  ) {
    refuse(
      `Authorization request parameters must not exceed ${OAUTH_AUTHORIZE_PARAMS_MAX_BYTES} bytes`,
      true
    );
  }

  if (!body || !STATE_WRITING_PATHS.has(ctx.path)) return;
  if (body.additionalData !== undefined) refuse("additionalData is not supported");
  for (const field of CALLBACK_URL_FIELDS) refuseOver(body, field, OAUTH_CALLBACK_URL_MAX_BYTES);
};
