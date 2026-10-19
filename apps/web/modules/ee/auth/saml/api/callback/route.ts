import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { truncateText } from "@/lib/utils/strings";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { checkSamlResponseBounds } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

/**
 * jackson rejects a response it cannot accept (unknown issuer or connection, IdP-initiated sign-in disabled, a
 * RelayState it did not issue) by throwing an error with a 4xx `statusCode`. It does not export the class, and the
 * production build renames it, so the status is the one reliable mark.
 */
/**
 * Longest jackson message or reason that reaches the log. They are fixed strings on this path today, but
 * nothing in jackson guarantees it (its OIDC path builds 4xx errors from provider text), and this endpoint is
 * anonymous, so the cap keeps a future version from writing attacker-sized lines.
 */
const LOGGED_TEXT_LIMIT = 200;

const getJacksonClientErrorStatus = (error: unknown): number | null => {
  const statusCode = error instanceof Error ? (error as { statusCode?: unknown }).statusCode : undefined;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : null;
};

export const POST = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    // Not a form body at all (wrong Content-Type, or a malformed one): the caller's fault, not a server error.
    return responses.badRequestResponse("The SAML callback expects a form body");
  }
  const SAMLResponse = formData.get("SAMLResponse");
  // An IdP-initiated sign-in carries no RelayState; jackson reads a missing one as "".
  const RelayState = formData.get("RelayState") ?? "";

  // A file part, an empty SAMLResponse or none at all is not a SAML response; jackson would throw on it and
  // answer 500.
  if (typeof SAMLResponse !== "string" || SAMLResponse === "" || typeof RelayState !== "string") {
    return responses.badRequestResponse("SAMLResponse and RelayState must be text fields");
  }

  const refusal = checkSamlResponseBounds(SAMLResponse);
  if (refusal) {
    // Sizes only, never content: with jackson's traces off (ENG-3976) this line is the one record a real IdP
    // response refused here would leave.
    logger.warn(refusal, "Refused a SAML response before parsing it");
    return responses.badRequestResponse(
      refusal.reason === "declaration"
        ? "SAMLResponse must not contain a DOCTYPE or other declaration"
        : "SAMLResponse is too large to process"
    );
  }

  // Only a request that is about to make jackson parse counts against the per-IP limit: the checks above cost
  // ~1-4 ms each behind the 256 KiB body limit, and counting them would let anyone behind the same NAT as a
  // tenant spend that tenant's sign-ins on junk. Without a trusted forwarding chain every caller shares one
  // identity, so the limit is skipped there and the bounds above are what each request costs.
  try {
    await applyIPRateLimit(rateLimitConfigs.auth.samlCallback, { skipUntrustedClient: true });
  } catch (error) {
    if (!(error instanceof TooManyRequestsError)) throw error;
    const response = responses.tooManyRequestsResponse(error.message);
    if (error.retryAfter !== undefined) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }

  let redirect_url: string | undefined;
  try {
    ({ redirect_url } = await oauthController.samlResponse({ RelayState, SAMLResponse }));
  } catch (error) {
    const status = getJacksonClientErrorStatus(error);
    if (status === null) throw error;
    // A response jackson refused is the sender's problem, not ours: answer it as such instead of a bare 500 that
    // reaches Sentry for every anonymous probe. Both texts are capped (see LOGGED_TEXT_LIMIT); with traces off this line
    // is the only record of why a login failed.
    const { message, internalError } = error as Error & { internalError?: unknown };
    logger.warn(
      {
        status,
        message: truncateText(message, LOGGED_TEXT_LIMIT),
        reason:
          typeof internalError === "string" ? truncateText(internalError, LOGGED_TEXT_LIMIT) : undefined,
      },
      "jackson refused a SAML response"
    );
    return status === 403
      ? responses.forbiddenResponse("The SAML response was not accepted")
      : responses.badRequestResponse("The SAML response was not accepted");
  }

  if (!redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  return redirect(redirect_url);
};
