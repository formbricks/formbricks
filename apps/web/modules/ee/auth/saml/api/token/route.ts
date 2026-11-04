import type { OAuthTokenReq } from "@boxyhq/saml-jackson";
import { responses } from "@/app/lib/api/response";
import { authErrorResponse } from "@/modules/auth/lib/auth-request-body-limit";
import { authBodyKindOf } from "@/modules/auth/lib/auth-request-bounds";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export const POST = async (req: Request) => {
  // A token request is form-encoded (RFC 6749 §4.1.3). withAuthRequestBodyLimit already holds every body
  // to JSON or a form; `formData()` reads only the form, so a JSON body is refused here.
  if (authBodyKindOf(req.headers.get("content-type")) !== "form") {
    return authErrorResponse(
      400,
      "invalid_request",
      "VALIDATION_ERROR",
      "The token request must be form-encoded"
    );
  }

  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { oauthController } = jacksonInstance;

  const body = await req.formData();
  const formData = Object.fromEntries(body.entries());

  const response = await oauthController.token(formData as unknown as OAuthTokenReq);

  return Response.json(response);
};
