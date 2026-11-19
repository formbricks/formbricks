import { APIError } from "better-auth/api";

/**
 * Largest callback URL (`callbackURL`, `errorCallbackURL`, `newUserCallbackURL`) a sign-in may carry, in
 * bytes as stored (see `storedBytes`) (ENG-6885).
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
 * Largest signed `oauth_query` a request may carry, in bytes once re-encoded the way oauth-provider stores it
 * (ENG-6885).
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
 * Largest `/oauth2/authorize` request: the bytes its parameters take as stored, as a JSON object inside
 * the record's JSON string (ENG-7396).
 *
 * Once a user has consented to a client, every authorize call issues a code, and oauth-provider stores
 * the code with the whole request in Redis for 10 minutes. Its schema caps no string and passes unknown
 * keys through, so the bound is on the request as a whole, not per field. An honest request is under 1 KB.
 * A request near this cap can still sign to more than {@link OAUTH_QUERY_MAX_BYTES} (percent-encoding and
 * oauth-provider's per-key name list grow it), and is then refused when it comes back to sign-in or
 * consent; no honest request comes near it.
 */
export const OAUTH_AUTHORIZE_PARAMS_MAX_BYTES = 8 * 1024;

const CALLBACK_URL_FIELDS = ["callbackURL", "errorCallbackURL", "newUserCallbackURL"] as const;

// Every route that writes a state record from the request body (`generateState`). `/link-social` needs a
// session and is closed over HTTP elsewhere, but `hooks.before` also runs for in-process calls.
const STATE_WRITING_PATHS = new Set(["/sign-in/social", "/link-social"]);

const AUTHORIZE_PATH = "/oauth2/authorize";

type TBoundedContext = {
  path: string;
  method?: string;
  body?: unknown;
  query?: unknown;
  authorizeSettings?: { isAuthorize?: boolean };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// `function` declarations, so a call narrows like any `never` (an arrow's inferred type does not).
// `VALIDATION_ERROR` and `PAYLOAD_TOO_LARGE` are the codes Better Auth's client and our body-limit guard
// already answer with (`auth-request-body-limit.ts`).
function refuseInvalid(message: string): never {
  throw new APIError("BAD_REQUEST", { message, code: "VALIDATION_ERROR" });
}

function refuseTooLarge(field: string, maxBytes: number): never {
  throw new APIError("PAYLOAD_TOO_LARGE", {
    message: `${field} must not exceed ${maxBytes} bytes`,
    code: "PAYLOAD_TOO_LARGE",
  });
}

/**
 * An authorize request over its cap answers RFC 6749's `invalid_request` (§4.1.2.1), a 400, which is what an
 * OAuth client reads, rather than CODING_STANDARDS' 413. It is not redirected to the client: the request is
 * refused before its client or redirect URI is checked, so nothing would vouch for that target.
 */
function refuseAuthorizeTooLarge(): never {
  const description = `Authorization request parameters must not exceed ${OAUTH_AUTHORIZE_PARAMS_MAX_BYTES} bytes`;
  throw new APIError("BAD_REQUEST", {
    error: "invalid_request",
    error_description: description,
    message: description,
    code: "VALIDATION_ERROR",
  });
}

/**
 * The bytes `value` takes in Redis. Better Auth stores a record as JSON whose value is itself a JSON string
 * (the state, or the code with its request), so a string is escaped twice: a `"` costs 4 bytes and a
 * control character up to 7. Measuring the raw input would let those multiply the cap.
 */
const storedBytes = (value: string): number =>
  // The two layers of surrounding quotes, 6 bytes, are not the value's own.
  Buffer.byteLength(JSON.stringify(JSON.stringify(value)), "utf8") - 6;

/**
 * Whether `value` takes more than `maxBytes` once escaped as {@link storedBytes} counts. Escaping only ever
 * adds bytes, so a value already over the cap raw is refused without escaping a quarter-megabyte twice.
 */
const exceedsStored = (value: string, maxBytes: number): boolean =>
  Buffer.byteLength(value, "utf8") > maxBytes || storedBytes(value) > maxBytes;

/**
 * Whether a request's parameters take more than `maxBytes` in Redis, stored as a JSON object inside the
 * record's JSON string (two layers, as for {@link storedBytes}), so the quotes, colon and comma around
 * every parameter count too: many short keys cost more than their text. The second layer only grows the
 * first, so it is computed only for a first layer that fits.
 */
const paramsExceedStored = (params: unknown, maxBytes: number): boolean => {
  if (params === undefined || params === null) return false;
  // First layer: the object as JSON. Second: that JSON as a string, without its own 2 quotes.
  const json = JSON.stringify(params);
  return (
    Buffer.byteLength(json, "utf8") > maxBytes ||
    Buffer.byteLength(JSON.stringify(json), "utf8") - 2 > maxBytes
  );
};

/**
 * The parameters `/oauth2/authorize` reads, the way oauth-provider picks them (`getAuthorizationRequestParameters`):
 * the body for an HTTP POST, the query otherwise. A resumed authorize (after sign-in, consent or continue)
 * carries `authorizeSettings` without `isAuthorize` and reads the replayed query alone; the body it carries
 * is the calling route's, holding the signed `oauth_query`, and is not stored.
 */
const authorizeParams = (ctx: TBoundedContext): unknown => {
  const settings = ctx.authorizeSettings ?? { isAuthorize: true };
  return ctx.method === "POST" && settings.isAuthorize === true ? ctx.body : ctx.query;
};

/**
 * The signed `oauth_query`, refused unless it is a string within {@link OAUTH_QUERY_MAX_BYTES}. It is measured
 * re-encoded, the form oauth-provider stores (a literal `"` comes back as `%22`, three times longer). A raw
 * query already over the cap is refused first: oauth-provider signs its queries canonically encoded, so an
 * honest one is the same length either way. `auth-request-bounds.ts` caps its field count before parsing.
 */
const boundOAuthQuery = (oauthQuery: unknown): void => {
  if (typeof oauthQuery !== "string") refuseInvalid("oauth_query must be a string");
  if (
    Buffer.byteLength(oauthQuery, "utf8") > OAUTH_QUERY_MAX_BYTES ||
    Buffer.byteLength(new URLSearchParams(oauthQuery).toString(), "utf8") > OAUTH_QUERY_MAX_BYTES
  ) {
    refuseTooLarge("oauth_query", OAUTH_QUERY_MAX_BYTES);
  }
};

/**
 * Before-hook that bounds what an OAuth request can make Better Auth store in Redis (ENG-6885, ENG-7396).
 * It runs before the endpoint and before oauth-provider's own hook, so a refused request writes nothing.
 *
 * - `/sign-in/social`, `/link-social` (the OAuth state record, ENG-6885): `additionalData` is refused
 *   outright, since Better Auth spreads it into the record unbounded and Formbricks never sends it. Each
 *   callback URL is capped at {@link OAUTH_CALLBACK_URL_MAX_BYTES}; one of the wrong type is left to the
 *   endpoint's schema, which refuses it before the record is written.
 * - `/oauth2/authorize` (the authorization-code record, ENG-7396): the parameters the endpoint reads are
 *   capped at {@link OAUTH_AUTHORIZE_PARAMS_MAX_BYTES}, for a direct call and a resumed one alike.
 * - A signed `oauth_query`, on any path: sign-in stores it in the state record, and sign-in, consent and
 *   continue replay it into authorize. Anything but a string is refused: oauth-provider's hook reads any
 *   truthy value with `new URLSearchParams`, which also takes key/value pairs or a record, and the signature
 *   still verifies, so the cap could otherwise be sidestepped.
 */
export const boundOAuthRecordsBeforeHandler = (ctx: TBoundedContext): void => {
  const body = isRecord(ctx.body) ? ctx.body : undefined;

  if (body && "oauth_query" in body) boundOAuthQuery(body.oauth_query);

  if (
    ctx.path === AUTHORIZE_PATH &&
    paramsExceedStored(authorizeParams(ctx), OAUTH_AUTHORIZE_PARAMS_MAX_BYTES)
  ) {
    refuseAuthorizeTooLarge();
  }

  if (!body || !STATE_WRITING_PATHS.has(ctx.path)) return;
  if (body.additionalData !== undefined) refuseInvalid("additionalData is not supported");
  for (const field of CALLBACK_URL_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && exceedsStored(value, OAUTH_CALLBACK_URL_MAX_BYTES)) {
      refuseTooLarge(field, OAUTH_CALLBACK_URL_MAX_BYTES);
    }
  }
};
