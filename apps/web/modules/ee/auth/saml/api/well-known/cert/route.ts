import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";

export async function GET() {
  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }

  const { spConfig } = jacksonInstance;

  const config = await spConfig.get();

  return new Response(config.publicKey, {
    status: 200,
    headers: {
      "Content-Type": "application/x-x509-ca-cert",
    },
  });
}
