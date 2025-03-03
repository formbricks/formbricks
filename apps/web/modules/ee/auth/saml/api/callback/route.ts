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
  const body = Object.fromEntries(formData.entries());

  const { RelayState, SAMLResponse } = body as unknown as SAMLCallbackBody;

  const { redirect_url } = await oauthController.samlResponse({
    RelayState,
    SAMLResponse,
  });

  if (!redirect_url) {
    return responses.internalServerErrorResponse("Failed to get redirect URL");
  }

  return redirect(redirect_url);
};
