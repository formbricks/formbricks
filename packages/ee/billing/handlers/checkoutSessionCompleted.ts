import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (!checkoutSession.metadata || !checkoutSession.metadata.teamId)
    throw new Error("No teamId found in checkout session");

  const stripeSubscriptionObject = await stripe.subscriptions.retrieve(
    checkoutSession.subscription as string
  );
  const { customer: stripeCustomer } = (await stripe.checkout.sessions.retrieve(checkoutSession.id, {
    expand: ["customer"],
  })) as { customer: Stripe.Customer };

  const organization = await getOrganization(checkoutSession.metadata!.organizationId);
  if (!organization) throw new Error("Organization not found.");

  await stripe.subscriptions.update(stripeSubscriptionObject.id, {
    metadata: {
      teamId: organization.id,
      responses: checkoutSession.metadata.responses,
      miu: checkoutSession.metadata.miu,
    },
  });

  await updateOrganization(organization.id, {
    billing: {
      ...organization.billing,
      stripeCustomerId: stripeCustomer.id,
    },
  });

  await stripe.customers.update(stripeCustomer.id, {
    name: organization.name,
    metadata: { organization: organization.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
