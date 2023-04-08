//import { buffer } from "micro";
import { prisma } from "@formbricks/database";
import { NextApiRequest, NextApiResponse } from "next";
import type { Readable } from "stream";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2022-11-15",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

// Stripe requires the raw body to construct the event.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const webhookHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "POST") {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"]!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(buf.toString(), sig, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // On error, log and return the error message.
      if (err! instanceof Error) console.log(err);
      console.log(`Error message: ${errorMessage}`);
      res.status(400).send(`Webhook Error: ${errorMessage}`);
      return;
    }

    // Cast event data to Stripe object.
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const teamId = checkoutSession.client_reference_id;
      if (!teamId) {
        console.error("No teamId found in checkout session");
        return res.json({ message: "skipping, no teamId found" });
      }
      const stripeCustomerId = checkoutSession.customer as string;
      const plan = "pro";
      await prisma.team.update({
        where: { id: teamId },
        data: {
          stripeCustomerId,
          plan,
        },
      });
      // add teamId to subscription metadata in Stripe
      const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          teamId,
        },
      });
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const teamId = subscription.metadata.teamId;
      if (!teamId) {
        console.error("No teamId found in subscription");
        return res.json({ message: "skipping, no teamId found" });
      }
      await prisma.team.update({
        where: { id: teamId },
        data: {
          plan: "free",
        },
      });
    } else {
      console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event.
    res.json({ received: true });
  } else {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
  }
};

export default webhookHandler;
