import { responses } from "@/app/lib/api/response";
import { default as webhookHandler } from "@formbricks/ee/billing/api/stripe-webhook";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get("stripe-signature") as string;

  const { status, message } = await webhookHandler(body, signature);

  if (status != 200) {
    return responses.badRequestResponse(message.toString());
  }
  return responses.successResponse({ message }, true);
}
