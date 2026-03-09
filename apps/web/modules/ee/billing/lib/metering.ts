import "server-only";
import { logger } from "@formbricks/logger";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { stripeClient } from "./stripe-client";

export const recordResponseCreatedMeterEvent = async (input: {
  stripeCustomerId: string | null | undefined;
  responseId: string;
  createdAt?: Date | string | null;
}): Promise<void> => {
  if (IS_FORMBRICKS_CLOUD && stripeClient && input.stripeCustomerId) {
    try {
      let createdAtSeconds: number | undefined;

      if (input.createdAt instanceof Date || typeof input.createdAt === "string") {
        createdAtSeconds = Math.floor(new Date(input.createdAt).getTime() / 1000);
      }

      await stripeClient.billing.meterEvents.create({
        event_name: "response_created",
        identifier: `response_created:${input.responseId}`,
        ...(typeof createdAtSeconds === "number" && Number.isFinite(createdAtSeconds)
          ? { timestamp: createdAtSeconds }
          : {}),
        payload: {
          stripe_customer_id: input.stripeCustomerId,
          value: "1",
        },
      });
    } catch (error) {
      logger.warn(
        { error, stripeCustomerId: input.stripeCustomerId, responseId: input.responseId },
        "Failed to record Stripe meter event for response_created"
      );
    }
  }
};
