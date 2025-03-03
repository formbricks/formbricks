import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (!checkoutSession.metadata || !checkoutSession.metadata.organizationId)
    throw new ResourceNotFoundError("No organizationId found in checkout session", checkoutSession.id);

  const stripeSubscriptionObject = await stripe.subscriptions.retrieve(
    checkoutSession.subscription as string
  );
  const { customer: stripeCustomer } = (await stripe.checkout.sessions.retrieve(checkoutSession.id, {
    expand: ["customer"],
  })) as { customer: Stripe.Customer };

  const organization = await getOrganization(checkoutSession.metadata!.organizationId);
  if (!organization)
    throw new ResourceNotFoundError("Organization not found", checkoutSession.metadata.organizationId);

  await stripe.subscriptions.update(stripeSubscriptionObject.id, {
    metadata: {
      organizationId: organization.id,
      responses: checkoutSession.metadata.responses,
      miu: checkoutSession.metadata.miu,
    },
  });

  await stripe.customers.update(stripeCustomer.id, {
    name: organization.name,
    metadata: { organizationId: organization.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
