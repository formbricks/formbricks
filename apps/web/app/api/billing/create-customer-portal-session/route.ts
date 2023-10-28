import { responses } from "@/app/lib/api/response";
import createCustomerPortalSession from "@formbricks/ee/billing/api/create-customer-portal-session";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const responseInput = await request.json();
    const { stripeCustomerId, returnUrl } = responseInput;
    const sessionUrl = await createCustomerPortalSession(stripeCustomerId, returnUrl);

    return responses.successResponse({ sessionUrl: sessionUrl }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
