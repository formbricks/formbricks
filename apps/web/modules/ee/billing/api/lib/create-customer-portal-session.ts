import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import Stripe from "stripe";

export const createCustomerPortalSession = async (stripeCustomerId: string, returnUrl: string) => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
};
