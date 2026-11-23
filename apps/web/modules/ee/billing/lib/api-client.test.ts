import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  changeBillingPlan,
  createBillingPortalSession,
  createPlanCheckoutSession,
  createSetupCheckoutSession,
  finalizeSetupCheckoutUpgrade,
  getBillingErrorReason,
  getUpgradeChargePreview,
  isBillingTransportFailure,
  newBillingIntentKey,
  reportUpgradePaymentIssue,
  retryStripeSetup,
  startHobbyPlan,
  startProTrial,
  undoPendingPlanChange,
  waitForBillingPaymentMethod,
  waitForBillingPlan,
} from "./api-client";

const fetchMock = vi.fn();
const ORG = "clorg11111111111111111111";
const BASE = `/api/internal/organizations/${ORG}/billing`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const problem = (status: number, detail: string) =>
  new Response(JSON.stringify({ status, detail }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const sentKey = (call: number) => fetchMock.mock.calls[call][1].headers["Idempotency-Key"];

describe("intent writes", () => {
  test.each([
    [
      "a plan change",
      () =>
        changeBillingPlan({
          organizationId: ORG,
          targetPlan: "pro",
          targetInterval: "yearly",
          intentKey: "k-1",
        }),
      "plan-changes",
      { targetPlan: "pro", targetInterval: "yearly" },
    ],
    [
      "a paid-plan checkout",
      () =>
        createPlanCheckoutSession({
          organizationId: ORG,
          targetPlan: "pro",
          targetInterval: "monthly",
          intentKey: "k-1",
        }),
      "checkout-sessions",
      { targetPlan: "pro", targetInterval: "monthly" },
    ],
    [
      "a setup checkout",
      () => createSetupCheckoutSession({ organizationId: ORG, targetPlan: "scale", intentKey: "k-1" }),
      "setup-checkout-sessions",
      { targetPlan: "scale" },
    ],
  ])("send %s with the intent's key and no client timeout", async (_name, call, resource, body) => {
    fetchMock.mockResolvedValue(json({ data: { url: "https://stripe.test" } }));

    await call();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/${resource}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(body);
    expect(init.headers).toEqual({ "Content-Type": "application/json", "Idempotency-Key": '"k-1"' });
    expect(init).not.toHaveProperty("signal");
  });

  test("retries a request that got no answer once, with the same key", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(json({ data: { mode: "immediate" } }));

    const result = await changeBillingPlan({
      organizationId: ORG,
      targetPlan: "scale",
      targetInterval: "monthly",
      intentKey: "k-1",
    });

    expect(result).toEqual({ mode: "immediate" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentKey(1)).toBe(sentKey(0));
  });

  test("gives up after the one retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      createPlanCheckoutSession({
        organizationId: ORG,
        targetPlan: "pro",
        targetInterval: "monthly",
        intentKey: "k-1",
      })
    ).rejects.toSatisfy(isBillingTransportFailure);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("never retries a refusal", async () => {
    fetchMock.mockResolvedValue(problem(403, "payment_method_required"));

    const error = await changeBillingPlan({
      organizationId: ORG,
      targetPlan: "pro",
      targetInterval: "monthly",
      intentKey: "k-1",
    }).catch((caught: unknown) => caught);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getBillingErrorReason(error)).toBe("payment_method_required");
    expect(isBillingTransportFailure(error)).toBe(false);
  });

  test("a new intent gets a new key", () => {
    const first = newBillingIntentKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(newBillingIntentKey()).not.toBe(first);
  });
});

describe("other writes", () => {
  test.each([
    ["the portal session", () => createBillingPortalSession(ORG), "portal-sessions", "POST", undefined],
    ["the Stripe setup retry", () => retryStripeSetup(ORG), "stripe-setups", "POST", undefined],
    ["the Hobby choice", () => startHobbyPlan(ORG), "hobby-subscriptions", "POST", undefined],
    ["the Pro trial", () => startProTrial(ORG), "pro-trials", "POST", undefined],
    ["the undo", () => undoPendingPlanChange(ORG), "pending-plan-change", "DELETE", undefined],
    [
      "the payment issue",
      () => reportUpgradePaymentIssue({ organizationId: ORG, paymentIntentId: "pi_1" }),
      "payment-issues",
      "POST",
      { paymentIntentId: "pi_1" },
    ],
    [
      "the setup-checkout finalize",
      () => finalizeSetupCheckoutUpgrade({ organizationId: ORG, checkoutSessionId: "cs_1" }),
      "setup-checkout-upgrades",
      "POST",
      { checkoutSessionId: "cs_1" },
    ],
    [
      "the plan wait",
      () => waitForBillingPlan({ organizationId: ORG, targetPlan: "pro" }),
      "plan-waits",
      "POST",
      { targetPlan: "pro" },
    ],
    [
      "the payment-method wait",
      () => waitForBillingPaymentMethod(ORG),
      "payment-method-waits",
      "POST",
      undefined,
    ],
  ])("send %s with no key and no client timeout", async (_name, call, resource, method, body) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await call();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/${resource}`);
    expect(init.method).toBe(method);
    expect(init.body === undefined ? undefined : JSON.parse(init.body)).toEqual(body);
    expect(init.headers?.["Idempotency-Key"]).toBeUndefined();
    expect(init).not.toHaveProperty("signal");
  });

  test("a write that got no answer is not retried without an intent key", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(startProTrial(ORG)).rejects.toBeInstanceOf(V3ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getUpgradeChargePreview", () => {
  test("reads the preview for the plan from the query", async () => {
    fetchMock.mockResolvedValue(json({ data: { amountDue: 8900, currency: "usd" } }));

    expect(
      await getUpgradeChargePreview({ organizationId: ORG, targetPlan: "scale", targetInterval: "yearly" })
    ).toEqual({ amountDue: 8900, currency: "usd" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/upgrade-charge-preview?targetPlan=scale&targetInterval=yearly`);
    expect(init.method).toBe("GET");
  });
});

describe("getBillingErrorReason", () => {
  test("is empty for anything that isn't a problem answer", () => {
    expect(getBillingErrorReason(new Error("boom"))).toBe("");
  });
});
