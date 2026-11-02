import type { OAuthTokenReq } from "@boxyhq/saml-jackson";
import { responses } from "@/app/lib/api/response";
import { mediaTypeOf } from "@/modules/auth/lib/auth-request-bounds";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export const POST = async (req: Request) => {
  // A token request is form-encoded (RFC 6749 §4.1.3), which is the only body the auth guard counts the
  // fields of; `formData()` would also take a multipart body, whose fields nothing would bound. The media
  // type is compared on its own, so a form type named only in a parameter does not pass.
  if (mediaTypeOf(req.headers.get("content-type")) !== "application/x-www-form-urlencoded") {
    return Response.json(
      { error: "invalid_request", error_description: "The token request must be form-encoded" },
      { status: 400 }
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
