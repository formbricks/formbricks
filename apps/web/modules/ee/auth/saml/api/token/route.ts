import type { OAuthTokenReq } from "@boxyhq/saml-jackson";
import { logger } from "@formbricks/logger";
import { responses } from "@/app/lib/api/response";
import { consumeSamlAuthnInstantForCode } from "@/modules/ee/auth/saml/lib/authn-instant";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export const POST = async (req: Request) => {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;

  const body = await req.formData();
  const formData = Object.fromEntries(body.entries());

  const response = await oauthController.token(formData as unknown as OAuthTokenReq);
  let authnInstant: string | null = null;

  try {
    authnInstant = await consumeSamlAuthnInstantForCode(formData.code);
  } catch (error) {
    logger.error({ error }, "Failed to consume SAML AuthnInstant");
  }

  return Response.json(authnInstant ? { ...response, authn_instant: authnInstant } : response);
};
