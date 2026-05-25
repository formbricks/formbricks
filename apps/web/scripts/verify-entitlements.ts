/**
 * Verify entitlements for every active/trialing customer on the Pro/Scale
 * products. Reports which customers have the expected post-backfill entitlement
 * present in their Stripe active_entitlements, and which don't.
 *
 * Read-only — no mutations.
 *
 * Usage:
 *   pnpm --filter web exec tsx scripts/verify-entitlements.ts \
 *     --product prod_XXX --product prod_YYY --expect new-feat-by-dhru-1
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import Stripe from "stripe";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

type Args = { products: string[]; expectKeys: string[] };

const parseArgs = (): Args => {
  const args: Args = { products: [], expectKeys: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--product") args.products.push(argv[++i]);
    else if (a === "--expect") args.expectKeys.push(argv[++i]);
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (args.products.length === 0 || args.expectKeys.length === 0) {
    console.error("Need at least one --product and one --expect <lookup_key>");
    process.exit(1);
  }
  return args;
};

const listActivePricesForProduct = async (productId: string): Promise<string[]> => {
  const ids: string[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    ids.push(...page.data.map((p) => p.id));
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return ids;
};

const listSubs = async (
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
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return all;
};

const listEntitlementKeys = async (customerId: string): Promise<string[]> => {
  const keys: string[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripe.entitlements.activeEntitlements.list({
      customer: customerId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const e of page.data) if (e.lookup_key) keys.push(e.lookup_key);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return keys;
};

const collectCustomers = async (products: string[]): Promise<Map<string, string>> => {
  const subToCustomer = new Map<string, string>();
  for (const productId of products) {
    const priceIds = await listActivePricesForProduct(productId);
    for (const priceId of priceIds) {
      for (const status of ["active", "trialing"] as const) {
        for (const sub of await listSubs(priceId, status)) {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          subToCustomer.set(sub.id, customerId);
        }
      }
    }
  }
  return subToCustomer;
};

const main = async () => {
  const args = parseArgs();
  console.log(
    `Verifying ${args.expectKeys.length} expected entitlement(s) across products: ${args.products.join(", ")}\n`
  );

  const subToCustomer = await collectCustomers(args.products);
  const customers = [...new Set(subToCustomer.values())];
  console.log(`${subToCustomer.size} subs → ${customers.length} unique customers\n`);

  const results: Array<{ customerId: string; missing: string[]; total: number }> = [];

  for (let i = 0; i < customers.length; i++) {
    const customerId = customers[i];
    const keys = await listEntitlementKeys(customerId);
    const missing = args.expectKeys.filter((k) => !keys.includes(k));
    results.push({ customerId, missing, total: keys.length });
    process.stdout.write(`\r  scanned ${i + 1}/${customers.length} customers`);
  }
  console.log("\n");

  const ok = results.filter((r) => r.missing.length === 0);
  const missing = results.filter((r) => r.missing.length > 0);

  console.log(`========== RESULT ==========`);
  console.log(`Customers with ALL expected entitlements: ${ok.length}/${customers.length}`);
  console.log(`Customers missing at least one:           ${missing.length}/${customers.length}`);
  if (missing.length > 0) {
    console.log("\nMissing entitlement(s) per customer:");
    for (const r of missing) {
      console.log(`  ${r.customerId} (${r.total} entitlements total) missing: ${r.missing.join(", ")}`);
    }
  }
  console.log(`============================`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
