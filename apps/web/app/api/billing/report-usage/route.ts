import { responses } from "@/app/lib/api/response";
import reportUsage from "@formbricks/ee/billing/api/report-usage";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const responseInput = await request.json();
    const { stripeCustomerId, metric } = responseInput;
    const { status, data } = await reportUsage(stripeCustomerId, metric);

    return responses.successResponse({ status, data }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
