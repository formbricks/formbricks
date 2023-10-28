import { responses } from "@/app/lib/api/response";
import removeSubscription from "@formbricks/ee/billing/api/remove-subscription";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const responseInput = await request.json();
    const { teamId, failureUrl, itemNickname } = responseInput;
    const { status, data, newPlan, url } = await removeSubscription(teamId, failureUrl, itemNickname);

    return responses.successResponse({ status, data, newPlan, url }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
