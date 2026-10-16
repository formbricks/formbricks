import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_TIMEOUT_MS = 15_000;

const mocks = vi.hoisted(() => ({
  pricesList: vi.fn(),
  cacheWithCache: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
}));

vi.mock("./stripe-client", () => ({
  stripeClient: {
    prices: {
      list: mocks.pricesList,
    },
  },
}));

const cacheStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: mocks.cacheWithCache,
  },
}));

const RESPONSE_PRICE_TIERS = [
  { flat_amount: null, flat_amount_decimal: null, unit_amount: 0, unit_amount_decimal: "0", up_to: 2000 },
  { flat_amount: null, flat_amount_decimal: null, unit_amount: 8, unit_amount_decimal: "8", up_to: 5000 },
  { flat_amount: null, flat_amount_decimal: null, unit_amount: 2, unit_amount_decimal: "2", up_to: null },
];

const EXPECTED_RESPONSE_OVERAGE = {
  currency: "usd",
  tiers: [
    { firstUnit: 0, lastUnit: 2000, perUnitCents: 0 },
    { firstUnit: 2001, lastUnit: 5000, perUnitCents: 8 },
    { firstUnit: 5001, lastUnit: null, perUnitCents: 2 },
  ],
};

const createPrice = ({
  id,
  plan,
  kind,
  interval,
  tiersMode = "graduated",
  created = 1_700_000_000,
  tagged = true,
  meter = null,
}: {
  id: string;
  plan: "hobby" | "pro" | "scale";
  kind: "base" | "responses";
  interval: "monthly" | "yearly";
  tiersMode?: "graduated" | "volume";
  created?: number;
  // false omits formbricks_price_kind, so getPriceKind classifies it via the usage_type fallback.
  tagged?: boolean;
  meter?: string | null;
}) => ({
  id,
  active: true,
  created,
  currency: "usd",
  unit_amount: kind === "responses" ? 0 : interval === "monthly" ? 1000 : 10000,
  ...(kind === "responses" ? { tiers: RESPONSE_PRICE_TIERS, tiers_mode: tiersMode } : {}),
  metadata: {
    formbricks_plan: plan,
    ...(tagged ? { formbricks_price_kind: kind } : {}),
    formbricks_interval: interval,
  },
  recurring: {
    usage_type: kind === "base" ? "licensed" : "metered",
    interval: interval === "monthly" ? "month" : "year",
    meter: kind === "base" ? null : meter,
  },
  product: {
    id: `prod_${plan}`,
    active: true,
    metadata: {
      formbricks_plan: plan,
    },
  },
});

// A Scale metered workflow-run price (ENG-1936). Its metadata kind is what keeps it from being
// misread as "responses" by the usage_type fallback.
const createWorkflowRunsPrice = (id: string) => ({
  id,
  active: true,
  currency: "usd",
  unit_amount: 0,
  tiers: RESPONSE_PRICE_TIERS,
  tiers_mode: "graduated",
  metadata: {
    formbricks_plan: "scale",
    formbricks_price_kind: "workflow_runs",
    formbricks_interval: "monthly",
  },
  recurring: { usage_type: "metered", interval: "month" },
  product: { id: "prod_scale", active: true, metadata: { formbricks_plan: "scale" } },
});

// The standard catalog minus the Pro responses price, so a test can supply its own Pro candidates.
const catalogWithProResponses = (proResponsePrices: ReturnType<typeof createPrice>[]) => [
  createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
  ...proResponsePrices,
  createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
  createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
];

const STANDARD_CATALOG_PRICES = [
  createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
  createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
  createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
  createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
  createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
];

describe("stripe-billing-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    cacheStore.clear();

    mocks.cacheWithCache.mockImplementation(async (fn: () => Promise<unknown>, key: string) => {
      if (cacheStore.has(key)) {
        return cacheStore.get(key);
      }

      const value = await fn();
      cacheStore.set(key, value);
      return value;
    });
  });

  test(
    "resolves the metadata-backed billing catalog",
    async () => {
      mocks.pricesList.mockResolvedValue({
        data: [
          createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
          createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
        ],
        has_more: false,
      });

      const { getCatalogItemsForPlan, getStripeBillingCatalogDisplay } =
        await import("./stripe-billing-catalog");

      await expect(getCatalogItemsForPlan("hobby", "monthly")).resolves.toEqual([
        { price: "price_hobby_monthly", quantity: 1 },
      ]);
      await expect(getCatalogItemsForPlan("pro", "yearly")).resolves.toEqual([
        { price: "price_pro_yearly", quantity: 1 },
        { price: "price_pro_responses" },
      ]);
      await expect(getStripeBillingCatalogDisplay()).resolves.toEqual({
        hobby: {
          monthly: {
            plan: "hobby",
            interval: "monthly",
            currency: "usd",
            unitAmount: 1000,
            responseOverage: null,
            workflowRunsIncluded: null,
            workflowRunsOverage: null,
          },
        },
        pro: {
          monthly: {
            plan: "pro",
            interval: "monthly",
            currency: "usd",
            unitAmount: 1000,
            responseOverage: EXPECTED_RESPONSE_OVERAGE,
            workflowRunsIncluded: null,
            workflowRunsOverage: null,
          },
          yearly: {
            plan: "pro",
            interval: "yearly",
            currency: "usd",
            unitAmount: 10000,
            responseOverage: EXPECTED_RESPONSE_OVERAGE,
            workflowRunsIncluded: null,
            workflowRunsOverage: null,
          },
        },
        scale: {
          monthly: {
            plan: "scale",
            interval: "monthly",
            currency: "usd",
            unitAmount: 1000,
            responseOverage: EXPECTED_RESPONSE_OVERAGE,
            workflowRunsIncluded: null,
            workflowRunsOverage: null,
          },
          yearly: {
            plan: "scale",
            interval: "yearly",
            currency: "usd",
            unitAmount: 10000,
            responseOverage: EXPECTED_RESPONSE_OVERAGE,
            workflowRunsIncluded: null,
            workflowRunsOverage: null,
          },
        },
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "omits responseOverage for volume-mode response prices",
    async () => {
      mocks.pricesList.mockResolvedValue({
        data: [
          createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
          createPrice({
            id: "price_pro_responses",
            plan: "pro",
            kind: "responses",
            interval: "monthly",
            tiersMode: "volume",
          }),
          createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
        ],
        has_more: false,
      });

      const { getStripeBillingCatalogDisplay } = await import("./stripe-billing-catalog");
      const display = await getStripeBillingCatalogDisplay();

      expect(display.pro.monthly.responseOverage).toBeNull();
      expect(display.scale.monthly.responseOverage).toEqual(EXPECTED_RESPONSE_OVERAGE);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "provisions a workflow_runs metered price as its own line item without colliding with responses",
    async () => {
      // A second metered price on Scale, tagged workflow_runs (ENG-1936). getPriceKind classifies it
      // by its metadata kind rather than the usage_type=metered fallback, so it does NOT produce a
      // second match for scale/responses/monthly (which would throw "found 2"), and it is added to the
      // subscription as its own metered line item.
      mocks.pricesList.mockResolvedValue({
        data: [...STANDARD_CATALOG_PRICES, createWorkflowRunsPrice("price_scale_workflow_runs")],
        has_more: false,
      });

      const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

      // Resolves without throwing "found 2"; the workflow_runs price is added as its own metered
      // line item (no quantity), alongside base and responses.
      await expect(getCatalogItemsForPlan("scale", "monthly")).resolves.toEqual([
        { price: "price_scale_monthly", quantity: 1 },
        { price: "price_scale_responses" },
        { price: "price_scale_workflow_runs" },
      ]);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "omits the workflow_runs line item when no such price exists on the plan (getOptionalSinglePrice -> null)",
    async () => {
      // No workflow_runs price anywhere in the catalog: the optional lookup resolves to null and the
      // Scale subscription is provisioned with base + responses only.
      mocks.pricesList.mockResolvedValue({
        data: STANDARD_CATALOG_PRICES,
        has_more: false,
      });

      const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

      await expect(getCatalogItemsForPlan("scale", "monthly")).resolves.toEqual([
        { price: "price_scale_monthly", quantity: 1 },
        { price: "price_scale_responses" },
      ]);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "rejects catalog construction when a plan has ambiguous (duplicate) workflow_runs prices",
    async () => {
      // Two active workflow_runs prices for scale/monthly: getOptionalSinglePrice must surface the
      // ambiguity rather than silently pick one, so the whole catalog build fails fast.
      mocks.pricesList.mockResolvedValue({
        data: [
          ...STANDARD_CATALOG_PRICES,
          createWorkflowRunsPrice("price_scale_workflow_runs_a"),
          createWorkflowRunsPrice("price_scale_workflow_runs_b"),
        ],
        has_more: false,
      });

      const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

      await expect(getCatalogItemsForPlan("scale", "monthly")).rejects.toThrow(
        "Expected at most one Stripe price for scale/workflow_runs/monthly, but found 2"
      );
    },
    TEST_TIMEOUT_MS
  );

  test(
    "exposes the included workflow-run volume from the price's free first tier (single source of truth)",
    async () => {
      // createWorkflowRunsPrice uses RESPONSE_PRICE_TIERS whose first tier is free (unit_amount 0) up
      // to 2000, so the displayed included volume must be 2000 — derived from the price, not an
      // entitlement — and null on plans with no workflow price.
      mocks.pricesList.mockResolvedValue({
        data: [...STANDARD_CATALOG_PRICES, createWorkflowRunsPrice("price_scale_workflow_runs")],
        has_more: false,
      });

      const { getStripeBillingCatalogDisplay } = await import("./stripe-billing-catalog");
      const display = await getStripeBillingCatalogDisplay();

      expect(display.scale.monthly.workflowRunsIncluded).toBe(2000);
      expect(display.scale.yearly.workflowRunsIncluded).toBe(2000);
      expect(display.pro.monthly.workflowRunsIncluded).toBeNull();
      expect(display.hobby.monthly.workflowRunsIncluded).toBeNull();
      // The graduated tiers are exposed for the plan-card tooltip, straight from the price.
      expect(display.scale.monthly.workflowRunsOverage).toEqual(EXPECTED_RESPONSE_OVERAGE);
      expect(display.pro.monthly.workflowRunsOverage).toBeNull();
    },
    TEST_TIMEOUT_MS
  );

  test(
    "degrades the workflow item only (keeps the catalog up) when the workflow price has no free first tier",
    async () => {
      // The footgun: a metered workflow price that charges from run #1 (first tier is NOT free). The
      // usage card must not claim "X of N included" while Stripe invoices every run. Rather than take
      // down the whole catalog (checkout + billing for every plan), the workflow item is dropped
      // (price + included → null, card hides, new subs skip it) and the failure is logged loudly; the
      // rest of the catalog resolves normally (ENG-2193/2194).
      const paidFromFirstUnit = {
        ...createWorkflowRunsPrice("price_scale_workflow_runs"),
        tiers: [
          {
            flat_amount: null,
            flat_amount_decimal: null,
            unit_amount: 8,
            unit_amount_decimal: "8",
            up_to: 2000,
          },
          {
            flat_amount: null,
            flat_amount_decimal: null,
            unit_amount: 2,
            unit_amount_decimal: "2",
            up_to: null,
          },
        ],
      };

      mocks.pricesList.mockResolvedValue({
        data: [...STANDARD_CATALOG_PRICES, paidFromFirstUnit],
        has_more: false,
      });

      const { getStripeBillingCatalogDisplay, getCatalogItemsForPlan } =
        await import("./stripe-billing-catalog");

      // Catalog resolves — no throw — and the workflow item is degraded to null (no false allowance).
      const display = await getStripeBillingCatalogDisplay();
      expect(display.scale.monthly.workflowRunsIncluded).toBeNull();
      expect(display.scale.monthly.workflowRunsOverage).toBeNull();

      // New Scale checkout skips the misconfigured workflow price (base + responses only).
      await expect(getCatalogItemsForPlan("scale", "monthly")).resolves.toEqual([
        { price: "price_scale_monthly", quantity: 1 },
        { price: "price_scale_responses" },
      ]);

      expect(mocks.loggerError).toHaveBeenCalled();
    },
    TEST_TIMEOUT_MS
  );

  describe("responses price resolution (ENG-1971)", () => {
    test(
      "picks the graduated price over a legacy volume price on the same plan instead of throwing",
      async () => {
        // Production shape behind FORMBRICKS-178: an untagged legacy metered volume price (newer, so
        // recency alone would pick it) next to the current graduated one. Both classify as
        // pro/responses/monthly; the old getSinglePrice threw "found 2" and 500'd the billing page.
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_legacy",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tiersMode: "volume",
              tagged: false,
              created: 1_800_000_000,
            }),
            createPrice({
              id: "price_pro_responses_graduated",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              created: 1_700_000_000,
            }),
          ]),
          has_more: false,
        });

        const { getStripeBillingCatalogDisplay, getCatalogItemsForPlan } =
          await import("./stripe-billing-catalog");

        const display = await getStripeBillingCatalogDisplay();
        expect(display.pro.monthly.responseOverage).toEqual(EXPECTED_RESPONSE_OVERAGE);
        expect(display.pro.yearly.responseOverage).toEqual(EXPECTED_RESPONSE_OVERAGE);

        // Checkout reads the same catalog item, so it provisions the same price the card displays.
        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_graduated" },
        ]);
        await expect(getCatalogItemsForPlan("pro", "yearly")).resolves.toEqual([
          { price: "price_pro_yearly", quantity: 1 },
          { price: "price_pro_responses_graduated" },
        ]);

        expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
        expect(mocks.loggerWarn).toHaveBeenCalledWith(
          expect.objectContaining({
            plan: "pro",
            interval: "monthly",
            chosenPriceId: "price_pro_responses_graduated",
            ignoredPriceIds: ["price_pro_responses_legacy"],
          }),
          expect.any(String)
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "prefers an untagged graduated price over a tagged volume price, and escalates to error",
      async () => {
        // The duplicated-in-dashboard case: Stripe copies metadata, so a legacy volume price can still
        // carry formbricks_price_kind=responses while the current graduated price is untagged. Graduated
        // must outrank the tag, or the tooltip disappears again.
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_tagged_volume",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tiersMode: "volume",
              created: 1_800_000_000,
            }),
            createPrice({
              id: "price_pro_responses_untagged_graduated",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tagged: false,
              created: 1_700_000_000,
            }),
          ]),
          has_more: false,
        });

        const { getStripeBillingCatalogDisplay, getCatalogItemsForPlan } =
          await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_untagged_graduated" },
        ]);
        const display = await getStripeBillingCatalogDisplay();
        expect(display.pro.monthly.responseOverage).toEqual(EXPECTED_RESPONSE_OVERAGE);

        // An untagged winner over a skipped tagged price is logged at error, not warn.
        expect(mocks.loggerWarn).not.toHaveBeenCalled();
        expect(mocks.loggerError).toHaveBeenCalledWith(
          expect.objectContaining({
            chosenPriceId: "price_pro_responses_untagged_graduated",
            chosenTiersMode: "graduated",
            ignoredPriceIds: ["price_pro_responses_tagged_volume"],
          }),
          expect.any(String)
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "never lets an untagged graduated price on another meter outrank the tagged responses price",
      async () => {
        // getPriceKind's usage_type fallback also classifies an untagged price of a different meter as
        // "responses". It must not win on tiers_mode and be attached to checkouts; a same-meter
        // duplicate of the responses price still may.
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_tagged_volume",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tiersMode: "volume",
              meter: "mtr_responses",
            }),
            createPrice({
              id: "price_pro_foreign_meter_graduated",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tagged: false,
              meter: "mtr_other",
              created: 1_800_000_000,
            }),
          ]),
          has_more: false,
        });

        const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_tagged_volume" },
        ]);
        expect(mocks.loggerWarn).toHaveBeenCalledWith(
          expect.objectContaining({ excludedPriceIds: ["price_pro_foreign_meter_graduated"] }),
          expect.any(String)
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "still prefers an untagged graduated duplicate on the same meter as the tagged price",
      async () => {
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_tagged_volume",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tiersMode: "volume",
              meter: "mtr_responses",
            }),
            createPrice({
              id: "price_pro_responses_untagged_graduated",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tagged: false,
              meter: "mtr_responses",
            }),
          ]),
          has_more: false,
        });

        const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_untagged_graduated" },
        ]);
      },
      TEST_TIMEOUT_MS
    );

    test(
      "picks the most recently created price when two graduated prices are equally tagged",
      async () => {
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_old",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              created: 1_700_000_000,
            }),
            createPrice({
              id: "price_pro_responses_new",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              created: 1_750_000_000,
            }),
          ]),
          has_more: false,
        });

        const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_new" },
        ]);
        expect(mocks.loggerWarn).toHaveBeenCalledWith(
          expect.objectContaining({
            chosenPriceId: "price_pro_responses_new",
            ignoredPriceIds: ["price_pro_responses_old"],
          }),
          expect.any(String)
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "prefers an explicitly tagged graduated price over a newer untagged graduated one",
      async () => {
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses_tagged",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              created: 1_700_000_000,
            }),
            createPrice({
              id: "price_pro_responses_untagged",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tagged: false,
              created: 1_800_000_000,
            }),
          ]),
          has_more: false,
        });

        const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).resolves.toEqual([
          { price: "price_pro_monthly", quantity: 1 },
          { price: "price_pro_responses_tagged" },
        ]);
      },
      TEST_TIMEOUT_MS
    );

    test(
      "keeps responseOverage null when the only responses price is volume-mode, without warning",
      async () => {
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([
            createPrice({
              id: "price_pro_responses",
              plan: "pro",
              kind: "responses",
              interval: "monthly",
              tiersMode: "volume",
            }),
          ]),
          has_more: false,
        });

        const { getStripeBillingCatalogDisplay } = await import("./stripe-billing-catalog");
        const display = await getStripeBillingCatalogDisplay();

        expect(display.pro.monthly.responseOverage).toBeNull();
        expect(mocks.loggerWarn).not.toHaveBeenCalled();
      },
      TEST_TIMEOUT_MS
    );

    test(
      "still fails the catalog when a plan has no responses price at all",
      async () => {
        mocks.pricesList.mockResolvedValue({
          data: catalogWithProResponses([]),
          has_more: false,
        });

        const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

        await expect(getCatalogItemsForPlan("pro", "monthly")).rejects.toThrow(
          "Expected a Stripe price for pro/responses/monthly, but found 0"
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  test(
    "fails fast when the catalog is incomplete",
    async () => {
      mocks.pricesList.mockResolvedValue({
        data: [createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" })],
        has_more: false,
      });

      const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

      await expect(getCatalogItemsForPlan("pro", "monthly")).rejects.toThrow(
        "Expected exactly one Stripe price for pro/base/monthly, but found 0"
      );
    },
    TEST_TIMEOUT_MS
  );

  test(
    "reuses the shared cached catalog across module reloads",
    async () => {
      mocks.pricesList.mockResolvedValue({
        data: [
          createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
          createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
        ],
        has_more: false,
      });

      const firstModule = await import("./stripe-billing-catalog");
      await firstModule.getStripeBillingCatalogDisplay();

      vi.resetModules();

      const secondModule = await import("./stripe-billing-catalog");
      await secondModule.getStripeBillingCatalogDisplay();

      expect(mocks.pricesList).toHaveBeenCalledTimes(1);
      expect(mocks.cacheWithCache).toHaveBeenCalledTimes(2);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "falls back to direct Stripe fetch when shared cache is unavailable",
    async () => {
      mocks.pricesList.mockResolvedValue({
        data: [
          createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
          createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
          createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
          createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
        ],
        has_more: false,
      });
      mocks.cacheWithCache.mockImplementationOnce(async (fn: () => Promise<unknown>) => await fn());

      const { getStripeBillingCatalogDisplay } = await import("./stripe-billing-catalog");

      await expect(getStripeBillingCatalogDisplay()).resolves.toMatchObject({
        hobby: {
          monthly: {
            plan: "hobby",
          },
        },
      });
      expect(mocks.pricesList).toHaveBeenCalledTimes(1);
    },
    TEST_TIMEOUT_MS
  );
});
