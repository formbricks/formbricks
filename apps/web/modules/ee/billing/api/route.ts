import { responses } from "@/app/lib/api/response";
import { webhookHandler } from "@/modules/ee/billing/api/lib/stripe-webhook";
import { headers } from "next/headers";

export const POST = async (request: Request) => {
  const body = await request.text();
  const requestHeaders = await headers();
  const signature = requestHeaders.get("stripe-signature") as string;

  const { status, message } = await webhookHandler(body, signature);

  if (status != 200) {
    return responses.badRequestResponse(message?.toString() || "Something went wrong");
  }
  return responses.successResponse({ message }, true);
};
