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

const CALLBACK_URL_FIELDS = ["callbackURL", "errorCallbackURL", "newUserCallbackURL"] as const;

// Every route that writes a state record from the request body (`generateState`). `/link-social` needs a
// session and is closed over HTTP elsewhere, but `hooks.before` also runs for in-process calls.
const STATE_WRITING_PATHS = new Set(["/sign-in/social", "/link-social"]);

const refuse = (message: string): never => {
  throw new APIError("BAD_REQUEST", { message, code: "VALIDATION_ERROR" });
};

/**
 * Before-hook that bounds what an OAuth sign-in stores in its state record (ENG-6885).
 *
 * `additionalData` is refused outright: Better Auth spreads it into the state record unbounded, and
 * Formbricks never sends it. Each callback URL is capped at {@link OAUTH_CALLBACK_URL_MAX_BYTES}. The
 * check runs before the endpoint, so a refused request writes nothing. Values of the wrong type are left
 * to the endpoint's own schema, which refuses them before anything is stored.
 */
export const boundOAuthStateBeforeHandler = (ctx: { path: string; body?: unknown }): void => {
  if (!STATE_WRITING_PATHS.has(ctx.path)) return;
  if (typeof ctx.body !== "object" || ctx.body === null) return;

  const body = ctx.body as Record<string, unknown>;
  if (body.additionalData !== undefined) refuse("additionalData is not supported");

  for (const field of CALLBACK_URL_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && Buffer.byteLength(value, "utf8") > OAUTH_CALLBACK_URL_MAX_BYTES) {
      refuse(`${field} must not exceed ${OAUTH_CALLBACK_URL_MAX_BYTES} bytes`);
    }
  }
};
