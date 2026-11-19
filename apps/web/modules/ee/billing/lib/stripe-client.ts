import "server-only";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";

export const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    })
  : null;
