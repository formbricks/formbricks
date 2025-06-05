import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { redirect } from "next/navigation";

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

  const formData = await req.formData();
  console.log("saml/callback: formData", formData);
  const body = Object.fromEntries(formData.entries());

  const { RelayState, SAMLResponse } = body as unknown as SAMLCallbackBody;
  console.log("saml/callback: RelayState", RelayState);
  console.log("saml/callback: SAMLResponse", SAMLResponse);

  const { redirect_url } = await oauthController.samlResponse({
    RelayState,
    SAMLResponse,
  });

  console.log("saml/callback: redirect_url", redirect_url);

  if (!redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  console.log("saml/callback: redirecting to", redirect_url);
  return redirect(redirect_url);
};
