import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { UNTRUSTED_CLIENT_IP, getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { checkSamlResponseBounds } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

/**
 * jackson rejects a response it cannot accept (unknown issuer or connection, IdP-initiated sign-in disabled, a
 * RelayState it did not issue) by throwing an error with a 4xx `statusCode`. It does not export the class, and the
 * production build renames it, so the status is the one reliable mark.
 */
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

  // jackson parses the whole response before it checks who sent it (ENG-3973), so both bounds run first:
  // how often one IP can make it parse, and how much markup it may parse.
  //
  // Without a trusted forwarding chain every caller resolves to the same shared identity, and a per-IP
  // limit there would let one caller lock SAML sign-in for the whole instance. Skip it then: the markup
  // budget still bounds what each request costs.
  if ((await getClientIpFromHeaders()) !== UNTRUSTED_CLIENT_IP) {
    try {
      await applyIPRateLimit(rateLimitConfigs.auth.samlCallback);
    } catch (error) {
      if (!(error instanceof TooManyRequestsError)) throw error;
      const response = responses.tooManyRequestsResponse(error.message);
      if (error.retryAfter !== undefined) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
  }

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

  // A file part, or no SAMLResponse at all, is not a SAML response; jackson would throw on it and answer 500.
  if (typeof SAMLResponse !== "string" || typeof RelayState !== "string") {
    return responses.badRequestResponse("SAMLResponse and RelayState must be text fields");
  }

  const refusal = checkSamlResponseBounds(SAMLResponse);
  if (refusal) {
    // Sizes only, never content: with jackson's traces off (ENG-3976) this line is the one record a real IdP
    // response refused here would leave.
    logger.warn(refusal, "Refused a SAML response before parsing it");
    return responses.badRequestResponse("SAMLResponse is too large to process");
  }

  let redirect_url: string | undefined;
  try {
    ({ redirect_url } = await oauthController.samlResponse({ RelayState, SAMLResponse }));
  } catch (error) {
    const status = getJacksonClientErrorStatus(error);
    if (status === null) throw error;
    // A response jackson refused is the sender's problem, not ours: answer it as such instead of a bare 500 that
    // reaches Sentry for every anonymous probe. The reason is one of jackson's fixed strings, never the response.
    const reason = (error as { internalError?: unknown }).internalError;
    logger.warn(
      { status, reason: typeof reason === "string" ? reason : undefined },
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
