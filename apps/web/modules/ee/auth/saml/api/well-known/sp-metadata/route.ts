import { responses } from "@/app/lib/api/response";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const encryption = searchParams.get("encryption") === "true";

  const jacksonInstance = await jackson();
  if (!jacksonInstance) {
    return responses.forbiddenResponse("SAML SSO is not enabled in your Formbricks license");
  }
  const { spConfig } = jacksonInstance;
  const xml = await spConfig.toXMLMetadata(encryption);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
};
