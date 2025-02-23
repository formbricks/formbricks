import jackson from "@/modules/ee/sso/lib/jackson";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
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
}
