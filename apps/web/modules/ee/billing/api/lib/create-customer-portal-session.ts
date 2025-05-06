import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

export const createCustomerPortalSession = async (stripeCustomerId: string, returnUrl: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    logger.error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");
    return { status: 500, message: "Stripe is not configured on the server.", data: null };
  }

  if (!stripeCustomerId) {
    logger.warn("createCustomerPortalSession called without stripeCustomerId.");
    return { status: 400, message: "Customer ID is required.", data: null };
  }

  if (!returnUrl) {
    logger.warn("createCustomerPortalSession called without returnUrl.");
    return { status: 400, message: "Return URL is required.", data: null };
  }

  // Initialize Stripe only after confirming the secret key exists.
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    // env.STRIPE_SECRET_KEY is confirmed to be a string here
    apiVersion: STRIPE_API_VERSION,
  });

  try {
    logger.debug(`Creating customer portal session for customer: ${stripeCustomerId}`);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    logger.info(`Successfully created customer portal session for customer: ${stripeCustomerId}`);
    return { status: 200, message: "Session created successfully.", data: session.url };
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error creating customer portal session";
    logger.error(
      error,
      `Error creating Stripe customer portal session for ${stripeCustomerId}: ${errorMessage}`
    );
    return { status: 500, message: `Error creating customer portal session: ${errorMessage}`, data: null };
  }
};
