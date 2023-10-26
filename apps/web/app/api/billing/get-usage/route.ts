import { responses } from "@/app/lib/api/response";
import getUsage from "@formbricks/ee/billing/api/get-subscription";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const responseInput = await request.json();
    const { stripeCustomerId } = responseInput;
    const { status, data, message } = await getUsage(stripeCustomerId);

    return responses.successResponse({ status, data, message }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
