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

const CALLBACK_URL_FIELDS = ["callbackURL", "errorCallbackURL", "newUserCallbackURL"] as const;

// Every route that writes a state record from the request body (`generateState`). `/link-social` needs a
// session and is closed over HTTP elsewhere, but `hooks.before` also runs for in-process calls.
const STATE_WRITING_PATHS = new Set(["/sign-in/social", "/link-social"]);

const refuse = (message: string): never => {
  throw new APIError("BAD_REQUEST", { message, code: "VALIDATION_ERROR" });
};

const refuseOver = (body: Record<string, unknown>, field: string, maxBytes: number): void => {
  const value = body[field];
  if (typeof value === "string" && Buffer.byteLength(value, "utf8") > maxBytes) {
    refuse(`${field} must not exceed ${maxBytes} bytes`);
  }
};

/**
 * Before-hook that bounds what an OAuth sign-in stores in its state record (ENG-6885).
 *
 * `additionalData` is refused outright: Better Auth spreads it into the state record unbounded, and
 * Formbricks never sends it. Each callback URL is capped at {@link OAUTH_CALLBACK_URL_MAX_BYTES}, and the
 * signed `oauth_query` at {@link OAUTH_QUERY_MAX_BYTES}. The check runs before the endpoint and before
 * oauth-provider's own hook, so a refused request writes nothing.
 *
 * A callback URL of the wrong type is left to the endpoint's schema, which refuses it before the state is
 * written. `oauth_query` has no such schema here: oauth-provider's hook reads any truthy value with
 * `new URLSearchParams`, which also takes key/value pairs or a record, and the signature still verifies.
 * So anything but a string is refused, or the byte cap could be sidestepped.
 */
export const boundOAuthStateBeforeHandler = (ctx: { path: string; body?: unknown }): void => {
  if (!STATE_WRITING_PATHS.has(ctx.path)) return;
  if (typeof ctx.body !== "object" || ctx.body === null) return;

  const body = ctx.body as Record<string, unknown>;
  if (body.additionalData !== undefined) refuse("additionalData is not supported");

  for (const field of CALLBACK_URL_FIELDS) refuseOver(body, field, OAUTH_CALLBACK_URL_MAX_BYTES);

  if (body.oauth_query !== undefined && typeof body.oauth_query !== "string") {
    refuse("oauth_query must be a string");
  }
  refuseOver(body, "oauth_query", OAUTH_QUERY_MAX_BYTES);
};
