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

// Metered like responses (ENG-1936): one meter event per created workflow run. Stripe aggregates
// events against the workflow-runs meter per customer per billing period and bills the overage
// beyond the plan's included volume — there is no hard cap here, matching response metering. Dry
// runs are never metered (the caller excludes them). Cloud-only, fire-and-forget: a failed meter
// event is logged but never blocks run creation.
export const recordWorkflowRunCreatedMeterEvent = async (input: {
  stripeCustomerId: string | null | undefined;
  workflowRunId: string;
  createdAt?: Date | string | null;
}): Promise<void> => {
  if (IS_FORMBRICKS_CLOUD && stripeClient && input.stripeCustomerId) {
    try {
      let createdAtSeconds: number | undefined;

      if (input.createdAt instanceof Date || typeof input.createdAt === "string") {
        createdAtSeconds = Math.floor(new Date(input.createdAt).getTime() / 1000);
      }

      await stripeClient.billing.meterEvents.create({
        event_name: "workflow_run_created",
        identifier: `workflow_run_created:${input.workflowRunId}`,
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
        { error, stripeCustomerId: input.stripeCustomerId, workflowRunId: input.workflowRunId },
        "Failed to record Stripe meter event for workflow_run_created"
      );
    }
  }
};
