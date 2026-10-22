import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@/lib/constants";
import { hashString } from "@/lib/hash-string";
import { toLogText } from "@/lib/utils/strings";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import {
  type SamlParseProbe,
  type SamlResponseClaims,
  probeSamlResponseParse,
} from "@/modules/ee/auth/saml/lib/saml-parse-budget";
import { checkSamlResponseBounds } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

/**
 * Longest jackson message, reason or error that reaches the log. They are fixed strings on this path today, but
 * nothing in jackson guarantees it (its OIDC path builds 4xx errors from provider text, and its validation errors
 * carry parser text), and this endpoint is anonymous, so the cap keeps any of them from writing attacker-sized
 * lines.
 */
const LOGGED_TEXT_LIMIT = 200;

/** jackson's `internalError` for a response with no issuer (`controller/oauth.js`), which is junk, not a misconfiguration. */
const JACKSON_NO_ISSUER_REASON = "Issuer not found.";

/** Longest response ID or InResponseTo that reaches the log; real ones are short random tokens. */
const LOGGED_ID_LIMIT = 128;

/**
 * The fixed codes a browser is sent to the login page with (`modules/auth/lib/oauth-error.ts` classifies them).
 * jackson's own wording never leaves the server log.
 */
export type SamlErrorCode = "saml_response_rejected" | "saml_unavailable" | "saml_connection_unavailable";

/**
 * Whether the callback is a browser's form post from the IdP. SAML's POST binding (SAML Bindings 2.0, 3.5.6)
 * forbids answering the user agent with HTTP error statuses for SAML processing failures: it is not a party to the
 * protocol, and a browser shows the user a raw error. Fetch Metadata says so directly; `Accept` is the fallback
 * for clients that do not send it.
 */
const isBrowserNavigation = (req: Request): boolean => {
  const mode = req.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return req.headers.get("accept")?.includes("text/html") ?? false;
};

/**
 * The login page with `code` as its error. Appended to `webappUrl` rather than resolved against it, which would drop
 * a custom base path (`https://host/custom-path` + `/auth/login` must not become `https://host/auth/login`). The
 * trailing slashes are trimmed by a reverse scan, not `replace(/\/+$/, "")`, which backtracks quadratically on a run
 * of slashes (as in `modules/auth/lib/oauth-urls.ts`).
 */
export const buildLoginErrorUrl = (webappUrl: string, code: SamlErrorCode): string => {
  let end = webappUrl.length;
  while (end > 0 && webappUrl[end - 1] === "/") end--;
  const loginUrl = new URL(`${webappUrl.slice(0, end)}/auth/login`);
  loginUrl.searchParams.set("error", code);
  return loginUrl.toString();
};

/** A browser goes to the login page with a fixed error code; any other caller gets `response` as it is. */
const refuse = (req: Request, code: SamlErrorCode, response: Response): Response => {
  if (!isBrowserNavigation(req)) return response;
  return new Response(null, {
    status: 303,
    headers: { Location: buildLoginErrorUrl(WEBAPP_URL, code), "Cache-Control": "private, no-store" },
  });
};

const ERROR_CODE_BY_STATUS: Record<number, string> = {
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
};

/** jackson's refusal, with its own 4xx status and a generic message. */
const jacksonRefusalResponse = (status: number): Response =>
  Response.json(
    {
      code: ERROR_CODE_BY_STATUS[status] ?? "bad_request",
      message: "The SAML response was not accepted",
      details: {},
    },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );

/**
 * jackson rejects a response it cannot accept (unknown issuer or connection, IdP-initiated sign-in disabled, a
 * RelayState it did not issue) by throwing an error with a 4xx `statusCode`. It does not export the class, and the
 * production build renames it, so the status is the one reliable mark.
 */
const getJacksonClientErrorStatus = (error: unknown): number | null => {
  const statusCode = error instanceof Error ? (error as { statusCode?: unknown }).statusCode : undefined;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : null;
};

/**
 * What a failure log line may say about the response (ENG-3976 turned jackson's traces off, so this is the record
 * left). Identifiers only, all of them as the sender claimed them before any signature was checked: the issuer,
 * the response ID and InResponseTo, the size, and RelayState hashed because it is jackson's session handle. Never
 * the response, its assertion, attributes or NameID.
 */
const failureContext = (samlResponse: string, relayState: string, claims?: SamlResponseClaims) => ({
  length: samlResponse.length,
  relayState: relayState ? hashString(relayState) : undefined,
  // Grouped so nobody reading the log takes them for checked values.
  claimed: claims
    ? {
        issuer: toLogText(claims.issuer, LOGGED_TEXT_LIMIT),
        responseId: toLogText(claims.id, LOGGED_ID_LIMIT),
        inResponseTo: toLogText(claims.inResponseTo, LOGGED_ID_LIMIT),
      }
    : undefined,
});

/**
 * Refusals on the cheap path (bounds) and of a full queue cost an anonymous caller one small request each, so they
 * are logged at most once per window per kind, with how many were left out since.
 */
const REFUSAL_LOG_WINDOW_MS = 10_000;
const refusalLogState = new Map<string, { loggedAt: number; suppressed: number }>();

const warnThrottled = (kind: string, fields: object, message: string) => {
  const now = Date.now();
  const state = refusalLogState.get(kind);
  if (state && now - state.loggedAt < REFUSAL_LOG_WINDOW_MS) {
    state.suppressed++;
    return;
  }
  logger.warn({ ...fields, suppressedSinceLast: state?.suppressed ?? 0 }, message);
  refusalLogState.set(kind, { loggedAt: now, suppressed: 0 });
};

/** The callback's two form fields, or the refusal for a body that does not carry them as text. */
const readCallbackForm = async (
  req: Request
): Promise<{ SAMLResponse: string; RelayState: string } | Response> => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    // Not a form body at all (wrong Content-Type, or a malformed one): the caller's fault, not a server error.
    return refuse(
      req,
      "saml_response_rejected",
      responses.badRequestResponse("The SAML callback expects a form body")
    );
  }
  const SAMLResponse = formData.get("SAMLResponse");
  // An IdP-initiated sign-in carries no RelayState; jackson reads a missing one as "".
  const RelayState = formData.get("RelayState") ?? "";

  // A file part, an empty SAMLResponse or none at all is not a SAML response; jackson would throw on it and
  // answer 500.
  if (typeof SAMLResponse !== "string" || SAMLResponse === "" || typeof RelayState !== "string") {
    return refuse(
      req,
      "saml_response_rejected",
      responses.badRequestResponse("SAMLResponse and RelayState must be text fields")
    );
  }
  return { SAMLResponse, RelayState };
};

/** The refusal for a response past the byte bounds or the caller's rate limit, or `null` when it may be parsed. */
const refuseBeforeParsing = async (req: Request, SAMLResponse: string): Promise<Response | null> => {
  const refusal = checkSamlResponseBounds(SAMLResponse);
  if (refusal) {
    // Sizes only, never content.
    warnThrottled(`bounds:${refusal.reason}`, refusal, "Refused a SAML response before parsing it");
    return refuse(
      req,
      "saml_response_rejected",
      responses.badRequestResponse(
        refusal.reason === "declaration"
          ? "SAMLResponse must not contain a DOCTYPE or other declaration"
          : "SAMLResponse is too large to process"
      )
    );
  }

  // Only a request that is about to be parsed counts against the per-IP limit: the checks above cost ~1-4 ms each
  // behind the 256 KiB body limit, and counting them would let anyone behind the same NAT as a tenant spend that
  // tenant's sign-ins on junk. Without a trusted forwarding chain every caller shares one identity, so the limit
  // is skipped there and the bounds above and the parse budget below are what each request costs.
  try {
    await applyIPRateLimit(rateLimitConfigs.auth.samlCallback, { skipUntrustedClient: true });
  } catch (error) {
    if (!(error instanceof TooManyRequestsError)) throw error;
    const response = responses.tooManyRequestsResponse(error.message);
    if (error.retryAfter !== undefined) response.headers.set("Retry-After", String(error.retryAfter));
    return refuse(req, "saml_unavailable", response);
  }
  return null;
};

/** The refusal for a response the worker did not parse within its budget, or could not parse at all. */
const refuseUnparsed = (
  req: Request,
  probe: Exclude<SamlParseProbe, { outcome: "parsed" }>,
  SAMLResponse: string,
  RelayState: string
): Response => {
  switch (probe.outcome) {
    case "busy":
      warnThrottled(
        "busy",
        failureContext(SAMLResponse, RelayState),
        "SAML parsing is saturated; refused a SAML response"
      );
      return refuse(
        req,
        "saml_unavailable",
        responses.serviceUnavailableResponse("Too many SAML responses are being processed; retry shortly", 1)
      );
    case "failed":
      logger.error(
        failureContext(SAMLResponse, RelayState),
        "SAML parse worker failed; refused a SAML response"
      );
      return refuse(
        req,
        "saml_unavailable",
        responses.serviceUnavailableResponse("The SAML response could not be processed; retry shortly", 1)
      );
    case "too_costly":
      logger.warn(
        { stage: "parse_budget", reason: probe.reason, ...failureContext(SAMLResponse, RelayState) },
        "Refused a SAML response that was too costly to parse"
      );
      return refuse(
        req,
        "saml_response_rejected",
        responses.badRequestResponse("SAMLResponse is too costly to process")
      );
  }
};

/** The answer to a response jackson threw on; anything but a jackson 4xx is rethrown. */
const refuseJacksonError = (
  req: Request,
  error: unknown,
  context: ReturnType<typeof failureContext>
): Response => {
  const status = getJacksonClientErrorStatus(error);
  if (status === null) throw error;
  // A response jackson refused is the sender's problem, not ours: answer it as such instead of a bare 500 that
  // reaches Sentry for every anonymous probe. With traces off this line is the only record of why it failed.
  const { message, internalError } = error as Error & { internalError?: unknown };
  logger.warn(
    {
      stage: "jackson",
      status,
      message: toLogText(message, LOGGED_TEXT_LIMIT),
      reason: toLogText(internalError, LOGGED_TEXT_LIMIT),
      ...context,
    },
    "jackson refused a SAML response"
  );
  // A missing, unknown or switched-off connection carries an `internalError`; retrying cannot clear it. The one
  // exception is jackson's "Issuer not found.", which means the response named no issuer at all: junk, not a
  // connection problem.
  const code =
    internalError && internalError !== JACKSON_NO_ISSUER_REASON
      ? "saml_connection_unavailable"
      : "saml_response_rejected";
  return refuse(req, code, jacksonRefusalResponse(status));
};

export const POST = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return refuse(
      req,
      "saml_connection_unavailable",
      responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license")
    );
  }
  const { oauthController } = jacksonInstance;

  const form = await readCallbackForm(req);
  if (form instanceof Response) return form;
  const { SAMLResponse, RelayState } = form;

  const refusal = await refuseBeforeParsing(req, SAMLResponse);
  if (refusal) return refusal;

  // The bounds model xmldom; this measures it. A worker parses the response under a time budget first, so a shape
  // the bounds misread costs the worker at most the budget and never blocks this thread for long.
  const probe = await probeSamlResponseParse(SAMLResponse);
  if (probe.outcome !== "parsed") return refuseUnparsed(req, probe, SAMLResponse, RelayState);
  const context = failureContext(SAMLResponse, RelayState, probe.claims);

  let result: Awaited<ReturnType<typeof oauthController.samlResponse>>;
  try {
    result = await oauthController.samlResponse({ RelayState, SAMLResponse });
  } catch (error) {
    return refuseJacksonError(req, error, context);
  }

  // A response that fails validation (signature, audience, expiry, decryption) does not throw: jackson returns a
  // redirect back to the sign-in flow with its raw error text in the URL. That text is parser and library detail,
  // so it is logged here and the redirect is not followed.
  if (result.error) {
    logger.warn(
      { stage: "validation", error: toLogText(result.error, LOGGED_TEXT_LIMIT), ...context },
      "SAML response failed validation"
    );
    return refuse(req, "saml_response_rejected", jacksonRefusalResponse(400));
  }

  if (!result.redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  return redirect(result.redirect_url);
};
