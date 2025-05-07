import { webhookHandler } from "@/modules/ee/billing/api/lib/stripe-webhook";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";

export const POST = async (request: Request) => {
  try {
    const body = await request.text();
    const requestHeaders = await headers(); // Corrected: headers() is async
    const signature = requestHeaders.get("stripe-signature");

    if (!signature) {
      logger.warn("Stripe signature missing from request headers.");
      return NextResponse.json({ message: "Stripe signature missing" }, { status: 400 });
    }

    const result = await webhookHandler(body, signature);

    if (result.status !== 200) {
      logger.error(`Webhook handler failed with status ${result.status}: ${result.message?.toString()}`);
      return NextResponse.json(
        { message: result.message?.toString() || "Webhook processing error" },
        { status: result.status }
      );
    }

    return NextResponse.json(result.message || { received: true }, { status: 200 });
  } catch (error: any) {
    logger.error(error, `Unhandled error in Stripe webhook POST handler: ${error.message}`);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
};
