import type Stripe from "stripe";

export type TResponsePricingTier = {
  firstUnit: number;
  lastUnit: number | null;
  perUnitCents: number;
};

// The graduated "responses" prices in Stripe are the source of truth for
// overage pricing. Tiers are derived from the fetched price at catalog-build
// time so the billing UI can never drift from what Stripe actually charges.
export const mapStripeTiersToResponsePricingTiers = (
  tiers: Stripe.Price.Tier[] | undefined
): TResponsePricingTier[] | null => {
  if (!tiers || tiers.length === 0) {
    return null;
  }

  const mapped: TResponsePricingTier[] = [];
  let firstUnit = 0;

  for (const [index, tier] of tiers.entries()) {
    const isLast = index === tiers.length - 1;
    if (tier.up_to === null && !isLast) {
      return null;
    }

    const perUnitCents =
      tier.unit_amount ?? (tier.unit_amount_decimal === null ? null : Number(tier.unit_amount_decimal));
    if (perUnitCents === null || Number.isNaN(perUnitCents)) {
      return null;
    }

    mapped.push({
      firstUnit,
      lastUnit: tier.up_to,
      perUnitCents,
    });

    if (tier.up_to !== null) {
      firstUnit = tier.up_to + 1;
    }
  }

  return mapped;
};

// The note under the Responses usage bar claims everything up to `limit` is included and the rest is
// billed at the tier rates. That only holds when Stripe's first tier is free and ends exactly at the
// entitlement limit; if the two drift, the note would contradict the tier table it links to, so it
// stays hidden. A null limit means unlimited responses, where there is no overage to explain.
export const isResponseOverageBilledAboveLimit = (
  limit: number | null,
  tiers: TResponsePricingTier[]
): limit is number => {
  const firstTier = tiers[0];
  return limit !== null && firstTier?.perUnitCents === 0 && firstTier.lastUnit === limit;
};
