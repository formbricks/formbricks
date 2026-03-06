import Stripe from "stripe";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("stripe-client", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("returns null when no Stripe secret key is configured", async () => {
    vi.doMock("@/lib/constants", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/constants")>();
      return actual;
    });
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: "",
      },
    }));

    const { stripeClient } = await import("./stripe-client");

    expect(stripeClient).toBeNull();
  });

  test("creates a Stripe client when secret key exists", async () => {
    vi.doMock("@/lib/constants", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/constants")>();
      return actual;
    });
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: "sk_test_123",
      },
    }));

    const { stripeClient } = await import("./stripe-client");

    expect(stripeClient).toBeInstanceOf(Stripe);
  });
});
