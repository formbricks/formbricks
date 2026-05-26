/**
 * Backfill Stripe entitlements for Pro Tier + Scale Tier subscribers by
 * forcing a recompute on each subscription. Customer-invisible (no invoice,
 * no proration, no plan change, no renewal-date shift, no email).
 *
 * Mechanism: for each unique base licensed price, reuse a persistent
 * "touch clone" Price (same attributes, fresh id, tagged
 * `metadata.clone_reason=entitlement_recompute_touch`). For each sub on
 * that source price, do a two-step `subscriptions.update`:
 *   1. Delete the base item, add an item on the touch clone, with
 *      proration_behavior=none. Stripe treats this as a real items change
 *      → recomputes active entitlements → fires
 *      `entitlements.active_entitlement_summary.updated` → our existing
 *      webhook handler runs syncOrganizationBillingFromStripe → DB updated.
 *   2. Round-trip: delete the clone item, add back the original source
 *      price. Subscription ends up on the original price, identical to
 *      before. (Second swap also fires the webhook; our handler is
 *      idempotent.)
 *
 * Touch clones are discovered-or-created automatically. They are NOT
 * archived afterwards — they're permanent fixtures reused across all
 * future entitlement rollouts.
 *
 * Recovery: if a sub is found currently on a touch clone (i.e. a prior
 * run died after swap #1 before swap #2), this script swaps it back to
 * the canonical source in a single update — that one swap still fires
 * the recompute event, so the entitlement gets refreshed.
 *
 * Safety:
 *   - Dry-run by default. Pass --apply to actually mutate.
 *   - Live-mode (`sk_live_`) + --apply triggers a 10s pause for Ctrl-C.
 *   - Per-sub error isolation: one failure does not abort the run.
 *   - Throttled to --rate ops/s (default 3) to respect Stripe API limits.
 *
 * Usage:
 *   pnpm --filter web exec tsx scripts/backfill-entitlements-touch-subscriptions.ts \
 *     --product prod_XXX --product prod_YYY
 *   # add --apply to execute, --limit N for a canary, --rate N to tune throughput.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import Stripe from "stripe";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local") });

const SECRET = process.env.STRIPE_SECRET_KEY;
if (!SECRET) {
  console.error("STRIPE_SECRET_KEY missing (expected in .env.local at repo root)");
  process.exit(1);
}

const stripe = new Stripe(SECRET, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });

const CLONE_REASON = "entitlement_recompute_touch";

type Args = {
  products: string[];
  apply: boolean;
  limit: number | null;
  rate: number;
};

const parseArgs = (): Args => {
  const args: Args = { products: [], apply: false, limit: null, rate: 3 };
  const argv = process.argv.slice(2);

  // Pull the value that follows a value-taking flag and bail out clearly if
  // it's missing or another flag. Without this, e.g. `--limit` at end-of-line
  // would parse as NaN and the script would slice(0, NaN) → empty → silently
  // process zero subscriptions with no error.
  const takeValue = (flag: string, i: number): string => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      console.error(`${flag} requires a value`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--product") {
      args.products.push(takeValue("--product", i));
      i++;
    } else if (a === "--apply") {
      args.apply = true;
    } else if (a === "--limit") {
      const raw = takeValue("--limit", i);
      i++;
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(`--limit must be a positive integer (got: ${raw})`);
        process.exit(1);
      }
      args.limit = parsed;
    } else if (a === "--rate") {
      const raw = takeValue("--rate", i);
      i++;
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(`--rate must be a positive number (got: ${raw})`);
        process.exit(1);
      }
      args.rate = parsed;
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (args.products.length === 0) {
    console.error("Need at least one --product <prod_id>");
    process.exit(1);
  }
  return args;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const log = (msg: string, extra?: Record<string, unknown>) => {
  if (extra) console.log(`[${new Date().toISOString()}] ${msg}`, JSON.stringify(extra));
  else console.log(`[${new Date().toISOString()}] ${msg}`);
};

const priceIdOf = (item: Stripe.SubscriptionItem): string =>
  typeof item.price === "string" ? item.price : item.price.id;

const isBaseLicensedItem = (item: Stripe.SubscriptionItem): boolean => {
  if (typeof item.price === "string") return false;
  return item.price.recurring?.usage_type === "licensed";
};

const isTouchClone = (price: Stripe.Price): boolean =>
  price.metadata?.clone_reason === CLONE_REASON && typeof price.metadata?.clone_of === "string";

const productIdOf = (price: Stripe.Price): string =>
  typeof price.product === "string" ? price.product : price.product.id;

// Source price attributes that must match for a clone to be reusable.
const priceAttributesMatch = (a: Stripe.Price, b: Stripe.Price): boolean =>
  a.currency === b.currency &&
  a.unit_amount === b.unit_amount &&
  a.recurring?.interval === b.recurring?.interval &&
  a.recurring?.interval_count === b.recurring?.interval_count &&
  a.recurring?.usage_type === b.recurring?.usage_type &&
  productIdOf(a) === productIdOf(b);

const listActivePricesForProduct = async (productId: string): Promise<Stripe.Price[]> => {
  const all: Stripe.Price[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return all;
};

const listSubscriptionsForPrice = async (
  priceId: string,
  status: Stripe.SubscriptionListParams.Status
): Promise<Stripe.Subscription[]> => {
  const all: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripe.subscriptions.list({
      price: priceId,
      status,
      limit: 100,
      expand: ["data.items.data.price"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return all;
};

const collectTargetSubscriptions = async (productIds: string[]): Promise<Stripe.Subscription[]> => {
  const byId = new Map<string, Stripe.Subscription>();
  for (const productId of productIds) {
    log(`Discovering subscriptions for product ${productId}`);
    const prices = await listActivePricesForProduct(productId);
    log(`  ${prices.length} active prices`);
    for (const price of prices) {
      for (const status of ["active", "trialing"] as const) {
        const subs = await listSubscriptionsForPrice(price.id, status);
        for (const sub of subs) byId.set(sub.id, sub);
      }
    }
  }
  return [...byId.values()];
};

const findExistingTouchClone = async (source: Stripe.Price): Promise<Stripe.Price | null> => {
  const prices = await listActivePricesForProduct(productIdOf(source));
  for (const candidate of prices) {
    if (candidate.metadata?.clone_of === source.id && candidate.metadata?.clone_reason === CLONE_REASON) {
      return candidate;
    }
  }
  return null;
};

const createTouchClone = async (source: Stripe.Price): Promise<Stripe.Price> => {
  if (!source.recurring) throw new Error(`source ${source.id} is not recurring`);
  if (source.unit_amount == null) {
    throw new Error(`source ${source.id} has no unit_amount (tiered/usage-based not supported)`);
  }
  return stripe.prices.create({
    currency: source.currency,
    unit_amount: source.unit_amount,
    product: productIdOf(source),
    recurring: {
      interval: source.recurring.interval,
      interval_count: source.recurring.interval_count,
      usage_type: source.recurring.usage_type,
    },
    // Set formbricks_plan to a non-standard marker so the billing catalog's
    // getPricePlan() returns null for this clone (STANDARD_CLOUD_PLANS only
    // contains hobby/pro/scale). That makes isCatalogCandidate() reject it,
    // preventing a "found 2 prices for pro/base/monthly" collision between
    // the real price and its clone. Source metadata is deliberately NOT
    // spread — clone identity is fully captured by clone_of + clone_reason.
    metadata: {
      formbricks_plan: "touch-clone",
      clone_of: source.id,
      clone_reason: CLONE_REASON,
      clone_created_at: new Date().toISOString(),
    },
    nickname: source.nickname ? `${source.nickname} (touch clone)` : "touch clone",
  });
};

// Idempotent: returns the existing touch clone if attributes still match; else
// archives it and creates a fresh one.
const ensureTouchClone = async (source: Stripe.Price, apply: boolean): Promise<Stripe.Price | null> => {
  const existing = await findExistingTouchClone(source);
  if (existing && priceAttributesMatch(existing, source)) {
    log(`  touch clone reused: ${existing.id}`);
    return existing;
  }
  if (existing) {
    log(`  WARN: existing touch clone ${existing.id} drifted from source; will archive + recreate`);
    if (apply) await stripe.prices.update(existing.id, { active: false });
  }
  if (!apply) {
    log(`  [dry-run] would create touch clone of ${source.id}`);
    return null;
  }
  const created = await createTouchClone(source);
  log(`  touch clone created: ${created.id}`);
  return created;
};

const swapBaseItem = async (
  subId: string,
  fromItemId: string,
  toPriceId: string,
  extraMetadata?: Record<string, string>
): Promise<Stripe.Subscription> => {
  return stripe.subscriptions.update(subId, {
    items: [{ id: fromItemId, deleted: true }, { price: toPriceId }],
    proration_behavior: "none",
    ...(extraMetadata && Object.keys(extraMetadata).length > 0 ? { metadata: extraMetadata } : {}),
  });
};

type SubTarget = {
  sub: Stripe.Subscription;
  baseItem: Stripe.SubscriptionItem;
  basePrice: Stripe.Price;
  canonicalSourceId: string;
  isStuckOnClone: boolean;
};

// Group subs by canonical source price. Subs found mid-recovery (currently on
// a touch clone) are grouped under their clone_of target, not under the clone
// itself — so we don't recursively clone-the-clone.
const groupAndClassify = (subs: Stripe.Subscription[]): Map<string, SubTarget[]> => {
  const out = new Map<string, SubTarget[]>();
  for (const sub of subs) {
    const baseItem = sub.items.data.find(isBaseLicensedItem);
    if (!baseItem) continue;
    const basePrice = baseItem.price as Stripe.Price;
    const stuckOnClone = isTouchClone(basePrice);
    const canonicalId = stuckOnClone ? (basePrice.metadata.clone_of as string) : basePrice.id;
    if (!out.has(canonicalId)) out.set(canonicalId, []);
    out.get(canonicalId)!.push({
      sub,
      baseItem,
      basePrice,
      canonicalSourceId: canonicalId,
      isStuckOnClone: stuckOnClone,
    });
  }
  return out;
};

type RunStats = {
  touched: number;
  recovered: number;
  failed: number;
  failures: Array<{ subscriptionId: string; customerId: string; phase: string; error: string }>;
};

const processSubGroup = async (
  canonicalSourceId: string,
  targets: SubTarget[],
  touchClone: Stripe.Price,
  apply: boolean,
  rateMs: number,
  reentitleAt: string,
  stats: RunStats
): Promise<void> => {
  for (let i = 0; i < targets.length; i++) {
    const { sub, baseItem, isStuckOnClone } = targets[i];
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const prefix = `  [${i + 1}/${targets.length}] sub=${sub.id} customer=${customerId}`;

    if (!apply) {
      console.log(
        `${prefix} ${isStuckOnClone ? "would-recover (clone→source)" : "would-roundtrip (source→clone→source)"}`
      );
      stats.touched++;
      if (isStuckOnClone) stats.recovered++;
      if (i < targets.length - 1) await sleep(rateMs);
      continue;
    }

    try {
      if (isStuckOnClone) {
        // Sub is already on the clone (prior run died mid-round-trip). One
        // swap brings it back to the canonical source and that swap itself
        // fires the entitlement recompute we wanted.
        await swapBaseItem(sub.id, baseItem.id, canonicalSourceId, {
          ...sub.metadata,
          reentitle_at: reentitleAt,
          reentitle_recovered: "true",
        });
        console.log(`${prefix} recovered (clone→source)`);
        stats.touched++;
        stats.recovered++;
      } else {
        // Normal case: round-trip source → clone → source.
        const afterSwap = await swapBaseItem(sub.id, baseItem.id, touchClone.id, {
          ...sub.metadata,
          reentitle_at: reentitleAt,
        });
        const cloneItem = afterSwap.items.data.find((it) => priceIdOf(it) === touchClone.id);
        if (!cloneItem) throw new Error("post-swap: could not locate clone item on subscription");
        await swapBaseItem(sub.id, cloneItem.id, canonicalSourceId);
        console.log(`${prefix} round-tripped`);
        stats.touched++;
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.log(`${prefix} FAILED ${error}`);
      stats.failures.push({
        subscriptionId: sub.id,
        customerId,
        phase: isStuckOnClone ? "recovery" : "round-trip",
        error,
      });
      stats.failed++;
    }

    if (i < targets.length - 1) await sleep(rateMs);
  }
};

const main = async () => {
  const args = parseArgs();
  const mode = args.apply ? "APPLY" : "DRY-RUN";
  const keyKind = SECRET.startsWith("sk_test_") ? "TEST" : SECRET.startsWith("sk_live_") ? "LIVE" : "UNKNOWN";

  log(`Starting backfill`, {
    mode,
    keyKind,
    products: args.products,
    rate: args.rate,
    limit: args.limit,
  });

  if (args.apply && keyKind === "LIVE") {
    log("LIVE-MODE APPLY — pausing 10s. Ctrl-C now if this is wrong.");
    await sleep(10_000);
  }

  const subs = await collectTargetSubscriptions(args.products);
  log(`Collected ${subs.length} unique subscriptions across target products`);

  const work = args.limit != null ? subs.slice(0, args.limit) : subs;
  if (args.limit != null) log(`Limiting to first ${work.length} subscriptions`);

  const grouped = groupAndClassify(work);
  log(`Grouped into ${grouped.size} canonical source price(s)`);

  const rateMs = Math.max(1, Math.floor(1000 / args.rate));
  const reentitleAt = String(Math.floor(Date.now() / 1000));

  const stats: RunStats = { touched: 0, recovered: 0, failed: 0, failures: [] };

  for (const [canonicalSourceId, targets] of grouped) {
    const sample = targets[0];
    const sourcePrice = sample.isStuckOnClone
      ? await stripe.prices.retrieve(canonicalSourceId)
      : sample.basePrice;
    log(
      `\nSource ${canonicalSourceId} (${sourcePrice.nickname ?? "no nickname"}): ${targets.length} sub(s)` +
        ` — ${targets.filter((t) => t.isStuckOnClone).length} stuck-on-clone, ${targets.filter((t) => !t.isStuckOnClone).length} normal`
    );

    const touchClone = await ensureTouchClone(sourcePrice, args.apply);
    if (!touchClone && args.apply) {
      log(`  ERROR: failed to ensure touch clone for ${canonicalSourceId}; skipping group`);
      for (const t of targets) {
        stats.failures.push({
          subscriptionId: t.sub.id,
          customerId: typeof t.sub.customer === "string" ? t.sub.customer : t.sub.customer.id,
          phase: "ensure-touch-clone",
          error: "no touch clone available",
        });
        stats.failed++;
      }
      continue;
    }

    if (touchClone) {
      await processSubGroup(canonicalSourceId, targets, touchClone, args.apply, rateMs, reentitleAt, stats);
    } else {
      // Dry-run with no existing clone — log what would happen.
      for (const { sub, isStuckOnClone } of targets) {
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        console.log(
          `  [dry-run] sub=${sub.id} customer=${customerId} ` +
            `${isStuckOnClone ? "would-recover (clone→source)" : "would-roundtrip (source→clone→source)"}`
        );
        stats.touched++;
        if (isStuckOnClone) stats.recovered++;
      }
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`mode:                  ${mode}`);
  console.log(`key:                   ${keyKind}`);
  console.log(`canonical source prices: ${grouped.size}`);
  console.log(`subs touched:          ${stats.touched}`);
  console.log(`  of which recovered:  ${stats.recovered}`);
  console.log(`failed:                ${stats.failed}`);
  console.log(`reentitle_at metadata: ${reentitleAt}`);
  if (stats.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of stats.failures) {
      console.log(`  sub=${f.subscriptionId} customer=${f.customerId} phase=${f.phase} err="${f.error}"`);
    }
  }
  console.log("=============================\n");

  // Exit non-zero on any failure so CI / shell wrappers can detect.
  if (stats.failed > 0) process.exit(2);
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
