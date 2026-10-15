import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { UNTRUSTED_CLIENT_IP, getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  countSamlResponseMarkup,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";

interface SAMLCallbackBody {
  RelayState: string;
  SAMLResponse: string;
}

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

  const formData = await req.formData();
  const body = Object.fromEntries(formData.entries());

  const { RelayState, SAMLResponse } = body as unknown as SAMLCallbackBody;

  if (typeof SAMLResponse === "string") {
    const markup = countSamlResponseMarkup(SAMLResponse);
    if (markup > SAML_RESPONSE_MARKUP_BUDGET) {
      // The size only, never the content: with jackson's traces off (ENG-3976) this line is the one record a
      // real IdP response refused here would leave.
      logger.warn({ markup, length: SAMLResponse.length }, "Refused a SAML response over the markup budget");
      return responses.badRequestResponse("SAMLResponse is too large to process");
    }
  }

  const { redirect_url } = await oauthController.samlResponse({
    RelayState,
    SAMLResponse,
  });

  if (!redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  return redirect(redirect_url);
};
