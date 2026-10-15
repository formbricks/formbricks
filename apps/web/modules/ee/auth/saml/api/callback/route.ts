import { redirect } from "next/navigation";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { isSamlResponseWithinBudget } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

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
  try {
    await applyIPRateLimit(rateLimitConfigs.auth.samlCallback);
  } catch (error) {
    if (error instanceof TooManyRequestsError) return responses.tooManyRequestsResponse(error.message);
    throw error;
  }

  const formData = await req.formData();
  const body = Object.fromEntries(formData.entries());

  const { RelayState, SAMLResponse } = body as unknown as SAMLCallbackBody;

  if (typeof SAMLResponse === "string" && !isSamlResponseWithinBudget(SAMLResponse)) {
    return responses.badRequestResponse("SAMLResponse is too large to process");
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
