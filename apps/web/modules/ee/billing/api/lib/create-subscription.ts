import { STRIPE_API_VERSION, STRIPE_PRICE_LOOKUP_KEYS, WEBAPP_URL } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

// It's generally recommended to initialize Stripe client inside the function or after checks,
// but keeping existing pattern and adding checks within the function.
const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const createSubscription = async (
  organizationId: string,
  environmentId: string,
  priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS
) => {
  logger.info(
    `Attempting to create/update subscription for organization ${organizationId} with price key ${priceLookupKey}`
  );

  if (!env.STRIPE_SECRET_KEY) {
    logger.error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");
    return {
      status: 500,
      message: "Stripe is not configured on the server.",
      newPlan: true, // Defaulting to true as per original error structure
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }

  if (!organizationId || !environmentId || !priceLookupKey) {
    logger.warn("Missing required parameters for createSubscription.", {
      organizationId,
      environmentId,
      priceLookupKey,
    });
    return {
      status: 400,
      message: "Missing required parameters.",
      newPlan: true,
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }

  try {
    const organization = await getOrganization(organizationId);
    if (!organization) {
      logger.error(`Organization not found: ${organizationId}`);
      return {
        status: 404,
        message: "Organization not found.",
        newPlan: true,
        url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      };
    }
    logger.debug(`Found organization: ${organization.name}`);

    let isNewCustomer = true;
    if (organization.billing.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(organization.billing.stripeCustomerId);
        if (customer && !customer.deleted) {
          isNewCustomer = false;
          logger.debug(`Existing Stripe customer found: ${organization.billing.stripeCustomerId}`);
        } else {
          logger.debug(
            `Stripe customer ${organization.billing.stripeCustomerId} not found or deleted. Treating as new customer.`
          );
        }
      } catch (e) {
        logger.warn(
          `Error retrieving Stripe customer ${organization.billing.stripeCustomerId}. Treating as new customer. Error: ${e.message}`
        );
        // Potentially customer ID is invalid or an old one, proceed as new.
      }
    } else {
      logger.debug("No Stripe customer ID found for organization. Treating as new customer.");
    }

    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey],
      expand: ["data.product"],
    });

    if (!prices.data || prices.data.length === 0) {
      logger.error(`Price not found for lookup key: ${priceLookupKey}`);
      return {
        status: 404,
        message: "Price plan not found.",
        newPlan: true,
        url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      };
    }
    const priceObject = prices.data[0];
    logger.debug(`Found price object ID: ${priceObject.id}`);

    const product = priceObject.product as Stripe.Product;
    const responses = product.metadata?.responses ? parseInt(product.metadata.responses) : undefined;
    const miu = product.metadata?.miu ? parseInt(product.metadata.miu) : undefined;

    if (responses === undefined || miu === undefined) {
      logger.error(
        `Product metadata for 'responses' or 'miu' is missing or invalid for price ${priceObject.id}. Product ID: ${product.id}`
      );
      return {
        status: 500,
        message: "Product configuration error.",
        newPlan: true,
        url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      };
    }
    logger.debug(`Product metadata parsed: responses=${responses}, miu=${miu}`);

    const checkoutSessionCreateParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceObject.id, quantity: 1 }],
      success_url: `${WEBAPP_URL}/billing-confirmation?environmentId=${environmentId}`,
      cancel_url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organizationId },
        // Consider making trial configurable or conditional
        // trial_period_days: 30,
      },
      metadata: { organizationId, responses: responses.toString(), miu: miu.toString() }, // Ensure metadata values are strings
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      payment_method_data: { allow_redisplay: "always" },
    };

    if (!isNewCustomer && organization.billing.stripeCustomerId) {
      checkoutSessionCreateParams.customer = organization.billing.stripeCustomerId;
      checkoutSessionCreateParams.customer_update = { name: "auto" };
      logger.debug(`Using existing customer ${organization.billing.stripeCustomerId} for checkout session.`);
    }

    if (isNewCustomer) {
      logger.info(`Creating new checkout session for new customer (organization ${organizationId}).`);
      const session = await stripe.checkout.sessions.create(checkoutSessionCreateParams);
      return {
        status: 200,
        message: "Your Plan has been upgraded!",
        newPlan: true,
        url: session.url,
      };
    } else {
      // Existing customer, check for existing subscriptions to update
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: organization.billing.stripeCustomerId as string, // Already checked this exists
        status: "all", // Consider active, trialing, past_due
      });

      const activeOrTrialingSubscription = existingSubscriptions.data.find(
        (sub) => sub.status === "active" || sub.status === "trialing"
      );

      if (activeOrTrialingSubscription) {
        logger.info(
          `Updating existing subscription ${activeOrTrialingSubscription.id} for customer ${organization.billing.stripeCustomerId}.`
        );
        const existingSubscriptionItem = activeOrTrialingSubscription.items.data[0];
        if (!existingSubscriptionItem) {
          logger.error(
            `No items found on existing subscription ${activeOrTrialingSubscription.id}. Cannot update.`
          );
          return {
            status: 500,
            message: "Subscription item missing, cannot update.",
            newPlan: false,
            url: "",
          };
        }

        await stripe.subscriptions.update(activeOrTrialingSubscription.id, {
          items: [{ id: existingSubscriptionItem.id, deleted: true }, { price: priceObject.id }],
          proration_behavior: "create_prorations", // Or 'none', depending on desired behavior
          cancel_at_period_end: false,
        });
        logger.info(`Successfully updated subscription ${activeOrTrialingSubscription.id}.`);
        return {
          status: 200,
          message: "Your plan has been updated successfully!",
          newPlan: false,
          url: "", // Or a success page specific to updates
        };
      } else {
        logger.info(
          `No active/trialing subscription found for existing customer ${organization.billing.stripeCustomerId}. Creating new checkout session.`
        );
        // No active subscription, create a new one via checkout
        const session = await stripe.checkout.sessions.create(checkoutSessionCreateParams);
        return {
          status: 200,
          message: "Your Plan has been upgraded!",
          newPlan: true, // Effectively a new plan for them
          url: session.url,
        };
      }
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      error,
      `Error in createSubscription for organization ${organizationId}, priceKey ${priceLookupKey}: ${errorMessage}`
    );
    return {
      status: 500,
      message: `Error processing subscription: ${errorMessage}`,
      newPlan: true, // Defaulting as per original
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }
};
