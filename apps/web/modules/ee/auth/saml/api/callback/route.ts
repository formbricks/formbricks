import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { redirect } from "next/navigation";

export const POST = async (req: Request) => {
  const { oauthController } = await jackson();

  const formData = await req.formData();
  const body = Object.fromEntries(formData.entries());

  const { RelayState, SAMLResponse } = body as unknown as {
    RelayState: string;
    SAMLResponse: string;
  };

  const { redirect_url } = await oauthController.samlResponse({
    RelayState,
    SAMLResponse,
  });

  return redirect(redirect_url as string);
};
