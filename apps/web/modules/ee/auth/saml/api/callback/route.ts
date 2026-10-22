import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { checkSamlResponseBounds } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

/**
 * Refusals before parsing cost an anonymous caller one small request each, so they are logged at most once per
 * window per reason, with how many were left out since.
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

export const POST = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;

  const formData = await req.formData();
  const { RelayState, SAMLResponse } = Object.fromEntries(formData.entries());

  // A file part, an empty SAMLResponse or none at all is not a SAML response; jackson would throw on it.
  if (typeof SAMLResponse !== "string" || SAMLResponse === "") {
    return responses.badRequestResponse("SAMLResponse must be a text field");
  }

  // jackson builds the whole XML DOM before it checks the issuer, the connection or RelayState, so an anonymous
  // caller chooses how much parsing this does (ENG-3973). Refuse what would cost too much first.
  const refusal = checkSamlResponseBounds(SAMLResponse);
  if (refusal) {
    // Sizes only, never content.
    warnThrottled(`bounds:${refusal.reason}`, refusal, "Refused a SAML response before parsing it");
    return responses.badRequestResponse(
      refusal.reason === "declaration"
        ? "SAMLResponse must not contain a DOCTYPE or other declaration"
        : "SAMLResponse is too large to process"
    );
  }

  // Only a response about to be parsed counts against the per-IP limit, so junk refused above cannot spend the
  // sign-ins of a tenant behind the same NAT. Without a trusted forwarding chain every caller shares one
  // identity, so the limit is skipped there and the bounds above are what each request costs.
  try {
    await applyIPRateLimit(rateLimitConfigs.auth.samlCallback, { skipUntrustedClient: true });
  } catch (error) {
    if (!(error instanceof TooManyRequestsError)) throw error;
    const response = responses.tooManyRequestsResponse(error.message);
    if (error.retryAfter !== undefined) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }

  const { redirect_url } = await oauthController.samlResponse({
    RelayState: RelayState as string,
    SAMLResponse,
  });

  if (!redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  return redirect(redirect_url);
};
