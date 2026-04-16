import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";

export const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });
};

export const getStripeWebhookSecret = () => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook is not enabled; STRIPE_WEBHOOK_SECRET is not set.");
  }

  return env.STRIPE_WEBHOOK_SECRET;
};
