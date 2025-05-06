import { PROJECT_FEATURE_KEYS, STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TOrganization,
  TOrganizationBillingPeriod,
  TOrganizationBillingPlan,
  ZOrganizationBillingPeriod,
  ZOrganizationBillingPlan,
} from "@formbricks/types/organizations";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

interface ParsedProductMetadata {
  plan: TOrganizationBillingPlan;
  responses: number | null;
  miu: number | null;
  projects: number | null;
}

const parseNumericMetadata = (
  value: string | undefined,
  fieldName: string,
  productId: string
): number | null => {
  if (value === "unlimited") return null;
  if (value === undefined || value === null) {
    logger.warn(
      `Product metadata for '${fieldName}' for product ${productId} is undefined or null. Assuming null.`
    );
    return null;
  }
  const num = parseInt(value);
  if (isNaN(num) || num < 0) {
    logger.error(`Invalid numeric value for '${fieldName}' in product ${productId} metadata: ${value}`);
    throw new Error(`Invalid ${fieldName} metadata in product: ${value}`);
  }
  return num;
};

const parseProductMetadata = (
  product: Stripe.Product
): { data?: ParsedProductMetadata; error?: { status: number; message: string } } => {
  if (!product.metadata?.plan) {
    logger.error(`Product ${product.id} is missing 'plan' in metadata.`);
    return { error: { status: 400, message: `Product ${product.id} is missing 'plan' in metadata.` } };
  }
  const planParseResult = ZOrganizationBillingPlan.safeParse(product.metadata.plan);
  if (!planParseResult.success) {
    logger.error(`Invalid 'plan' in product metadata for ${product.id}: ${product.metadata.plan}`);
    return {
      error: { status: 400, message: `Invalid 'plan' in product metadata: ${product.metadata.plan}` },
    };
  }
  const plan = planParseResult.data;

  try {
    const responses = parseNumericMetadata(product.metadata.responses, "responses", product.id);
    const miu = parseNumericMetadata(product.metadata.miu, "miu", product.id);
    const projects = parseNumericMetadata(product.metadata.projects, "projects", product.id);
    logger.debug(
      `Parsed metadata for product ${product.id}: plan=${plan}, responses=${responses}, miu=${miu}, projects=${projects}`
    );
    return { data: { plan, responses, miu, projects } };
  } catch (e: any) {
    logger.error(
      `Error parsing product metadata limits for product ${product.id}: ${e.message ?? "Unknown error"}`
    );
    return { error: { status: 400, message: e.message ?? "Failed to parse product metadata limits" } };
  }
};

const determineNewPlan = (
  planFromProduct: TOrganizationBillingPlan,
  organizationId: string,
  productId: string
): { newPlan?: TOrganizationBillingPlan; error?: { status: number; message: string } } => {
  let updatedBillingPlan: TOrganizationBillingPlan;
  switch (planFromProduct) {
    case PROJECT_FEATURE_KEYS.FREE:
      updatedBillingPlan = PROJECT_FEATURE_KEYS.STARTUP;
      logger.warn(
        `Subscription product ${productId} has plan 'FREE'. Organization ${organizationId} will be updated to 'STARTUP'.`
      );
      break;
    case PROJECT_FEATURE_KEYS.STARTUP:
      updatedBillingPlan = PROJECT_FEATURE_KEYS.STARTUP;
      break;
    case PROJECT_FEATURE_KEYS.SCALE:
      updatedBillingPlan = PROJECT_FEATURE_KEYS.SCALE;
      break;
    case PROJECT_FEATURE_KEYS.ENTERPRISE:
      updatedBillingPlan = PROJECT_FEATURE_KEYS.ENTERPRISE;
      break;
    default:
      logger.error(
        `Unknown plan type '${planFromProduct}' from product metadata for product ${productId} (Org: ${organizationId}).`
      );
      return {
        error: { status: 500, message: `Unknown plan type '${planFromProduct}' encountered.` },
      };
  }
  return { newPlan: updatedBillingPlan };
};

interface SubscriptionContext {
  organization: TOrganization;
  product: Stripe.Product;
  period: TOrganizationBillingPeriod;
  stripeSubscriptionObject: Stripe.Subscription;
}

const getAndValidateSubscriptionContext = async (
  stripeSubscriptionObject: Stripe.Subscription,
  organizationId: string
): Promise<{ data?: SubscriptionContext; error?: { status: number; message: string } }> => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    logger.warn(
      `Organization not found with ID: ${organizationId}. Subscription ID: ${stripeSubscriptionObject.id}`
    );
    return { error: { status: 404, message: `Organization not found: ${organizationId}` } };
  }
  logger.debug(`Found organization: ${organization.name} (ID: ${organizationId})`);

  if (!stripeSubscriptionObject.items?.data?.[0]?.price?.product) {
    logger.error(
      `Subscription ${stripeSubscriptionObject.id} (Org: ${organizationId}) is missing price or product information.`
    );
    return {
      error: { status: 400, message: "Subscription is missing critical price or product information." },
    };
  }
  const subscriptionPrice = stripeSubscriptionObject.items.data[0].price;
  const productId =
    typeof subscriptionPrice.product === "string" ? subscriptionPrice.product : subscriptionPrice.product.id;

  const product = await stripe.products.retrieve(productId);
  if (!product) {
    logger.error(
      `Product not found with ID: ${productId}. Subscription ID: ${stripeSubscriptionObject.id} (Org: ${organizationId})`
    );
    return { error: { status: 404, message: `Product not found: ${productId}` } };
  }
  logger.debug(
    `Retrieved product: ${product.name} (ID: ${product.id}) for subscription ${stripeSubscriptionObject.id}`
  );

  let period: TOrganizationBillingPeriod = "monthly"; // Default period
  if (subscriptionPrice.metadata?.period) {
    const periodParsed = ZOrganizationBillingPeriod.safeParse(subscriptionPrice.metadata.period);
    if (periodParsed.success) {
      period = periodParsed.data;
      logger.debug(`Parsed billing period: ${period} for subscription ${stripeSubscriptionObject.id}`);
    } else {
      logger.warn(
        `Failed to parse period from subscription price metadata: ${subscriptionPrice.metadata.period} for subscription ${stripeSubscriptionObject.id}. Defaulting to 'monthly'.`
      );
    }
  } else {
    logger.info(
      `No period found in subscription price metadata for subscription ${stripeSubscriptionObject.id}. Defaulting to 'monthly'.`
    );
  }

  return { data: { organization, product, period, stripeSubscriptionObject } };
};

export const handleSubscriptionCreatedOrUpdated = async (event: Stripe.Event) => {
  logger.info(`Processing event type: ${event.type} for event ID: ${event.id}`);

  if (!env.STRIPE_SECRET_KEY) {
    logger.error("Stripe secret key is not configured.");
    return { status: 500, message: "Stripe secret key is not configured." };
  }

  const initialStripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = initialStripeSubscriptionObject.metadata?.organizationId;

  logger.info(
    `Handling subscription created/updated for subscription ID: ${initialStripeSubscriptionObject.id}, Organization ID: ${organizationId}`
  );

  if (!organizationId) {
    logger.error(
      { eventId: event.id, subscriptionId: initialStripeSubscriptionObject.id },
      "No organizationId found in subscription metadata."
    );
    return { status: 400, message: "Skipping event: No organizationId found in subscription metadata." };
  }

  if (
    !["active", "trialing"].includes(initialStripeSubscriptionObject.status) ||
    initialStripeSubscriptionObject.cancel_at_period_end
  ) {
    logger.info(
      `Subscription ${initialStripeSubscriptionObject.id} (Org: ${organizationId}) is not active/trialing or is pending cancellation. Status: ${initialStripeSubscriptionObject.status}, Cancel at period end: ${initialStripeSubscriptionObject.cancel_at_period_end}. Skipping update.`
    );
    return {
      status: 200,
      message: "Subscription not active/trialing or pending cancellation; no action taken.",
    };
  }

  try {
    const contextResult = await getAndValidateSubscriptionContext(
      initialStripeSubscriptionObject,
      organizationId
    );
    if (contextResult.error || !contextResult.data) {
      return { status: contextResult.error!.status, message: contextResult.error!.message };
    }
    const { organization, product, period, stripeSubscriptionObject } = contextResult.data;

    const metadataResult = parseProductMetadata(product);
    if (metadataResult.error || !metadataResult.data) {
      return { status: metadataResult.error!.status, message: metadataResult.error!.message };
    }
    const { plan: planFromProduct, responses, miu, projects } = metadataResult.data;

    const planResult = determineNewPlan(planFromProduct, organizationId, product.id);
    if (planResult.error || !planResult.newPlan) {
      return { status: planResult.error!.status, message: planResult.error!.message };
    }
    const updatedBillingPlan = planResult.newPlan;
    logger.info(`Determined updated billing plan for organization ${organizationId}: ${updatedBillingPlan}`);

    await updateOrganization(organizationId, {
      billing: {
        ...organization.billing,
        stripeCustomerId: stripeSubscriptionObject.customer as string,
        plan: updatedBillingPlan,
        period,
        periodStart: new Date(stripeSubscriptionObject.current_period_start * 1000),
        limits: {
          projects,
          monthly: {
            responses,
            miu,
          },
        },
      },
    });
    logger.info(
      `Successfully updated organization ${organizationId} billing to plan ${updatedBillingPlan}, period ${period} for subscription ${stripeSubscriptionObject.id}.`
    );

    const customerId = stripeSubscriptionObject.customer;
    if (typeof customerId !== "string") {
      logger.error(
        `Invalid customer ID type: ${typeof customerId} for subscription ${stripeSubscriptionObject.id}. Skipping Stripe customer update.`
      );
      return {
        status: 200, // Organization update might have succeeded
        message: "Organization updated, but Stripe customer update skipped due to invalid customer ID.",
      };
    }

    await stripe.customers.update(customerId, {
      name: organization.name,
      metadata: { organizationId: organization.id },
      invoice_settings: {
        default_payment_method: stripeSubscriptionObject.default_payment_method as string | undefined,
      },
    });
    logger.info(
      `Successfully updated Stripe customer ${customerId} with organization info for subscription ${stripeSubscriptionObject.id}.`
    );

    return {
      status: 200,
      message: "Subscription created/updated and organization billing updated successfully.",
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      error,
      `Error in handleSubscriptionCreatedOrUpdated for subscription ${initialStripeSubscriptionObject.id} (Org: ${organizationId}): ${errorMessage}`
    );
    if (error instanceof ResourceNotFoundError) {
      // This might be redundant if getOrganization handles it, but good for safety
      return { status: 404, message: error.message };
    }
    // For other errors, return a generic 500 to Stripe
    return { status: 500, message: `Internal server error: ${errorMessage}` };
  }
};
