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

/** Longest response ID or InResponseTo that reaches the log; real ones are short random tokens. */
const LOGGED_ID_LIMIT = 128;

/**
 * The fixed codes a browser is sent to the login page with (`modules/auth/lib/oauth-error.ts` classifies them).
 * jackson's own wording never leaves the server log.
 */
type SamlErrorCode = "saml_response_rejected" | "saml_unavailable" | "saml_connection_unavailable";

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

/** A browser goes to the login page with a fixed error code; any other caller gets `response` as it is. */
const refuse = (req: Request, code: SamlErrorCode, response: Response): Response => {
  if (!isBrowserNavigation(req)) return response;
  const loginUrl = new URL("/auth/login", WEBAPP_URL);
  loginUrl.searchParams.set("error", code);
  return new Response(null, {
    status: 303,
    headers: { Location: loginUrl.toString(), "Cache-Control": "private, no-store" },
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
  claimedIssuer: toLogText(claims?.issuer, LOGGED_TEXT_LIMIT),
  responseId: toLogText(claims?.id, LOGGED_ID_LIMIT),
  inResponseTo: toLogText(claims?.inResponseTo, LOGGED_ID_LIMIT),
});

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

  const refusal = checkSamlResponseBounds(SAMLResponse);
  if (refusal) {
    // Sizes only, never content.
    logger.warn(refusal, "Refused a SAML response before parsing it");
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

  // The bounds above model xmldom; this measures it. A worker parses the response under a time budget first, so a
  // shape the bounds misread costs the worker at most the budget and never blocks this thread for long.
  const probe = await probeSamlResponseParse(SAMLResponse);
  if (probe.outcome === "busy") {
    logger.warn(failureContext(SAMLResponse, RelayState), "SAML parse queue full; refused a SAML response");
    return refuse(
      req,
      "saml_unavailable",
      responses.serviceUnavailableResponse("Too many SAML responses are being processed; retry shortly", 1)
    );
  }
  if (probe.outcome === "failed") {
    logger.error(
      failureContext(SAMLResponse, RelayState),
      "SAML parse worker failed; refused a SAML response"
    );
    return refuse(
      req,
      "saml_unavailable",
      responses.serviceUnavailableResponse("The SAML response could not be processed; retry shortly", 1)
    );
  }
  if (probe.outcome === "too_slow") {
    logger.warn(
      { stage: "parse_budget", ...failureContext(SAMLResponse, RelayState) },
      "Refused a SAML response that took too long to parse"
    );
    return refuse(
      req,
      "saml_response_rejected",
      responses.badRequestResponse("SAMLResponse is too costly to process")
    );
  }
  const context = failureContext(SAMLResponse, RelayState, probe.claims);

  let result: Awaited<ReturnType<typeof oauthController.samlResponse>>;
  try {
    result = await oauthController.samlResponse({ RelayState, SAMLResponse });
  } catch (error) {
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
    // A missing, unknown or switched-off connection carries an `internalError`; retrying cannot clear it.
    const code = internalError ? "saml_connection_unavailable" : "saml_response_rejected";
    return refuse(req, code, jacksonRefusalResponse(status));
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
