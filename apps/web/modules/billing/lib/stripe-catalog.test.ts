import Stripe from "stripe";
import { describe, expect, test } from "vitest";
import { getCloudPlanFromProduct } from "./stripe-catalog";

const product = (input: Partial<Stripe.Product> & Pick<Stripe.Product, "id">): Stripe.Product =>
  input as Stripe.Product;

describe("stripe catalog mapping", () => {
  test("maps known product metadata values to cloud plans", () => {
    expect(
      getCloudPlanFromProduct(product({ id: "prod_hobby", metadata: { formbricks_plan: "hobby" } }))
    ).toBe("hobby");
    expect(getCloudPlanFromProduct(product({ id: "prod_pro", metadata: { formbricks_plan: "pro" } }))).toBe(
      "pro"
    );
    expect(
      getCloudPlanFromProduct(product({ id: "prod_scale", metadata: { formbricks_plan: "scale" } }))
    ).toBe("scale");
  });

  test("falls back to unknown for missing or unknown products", () => {
    expect(getCloudPlanFromProduct(null)).toBe("unknown");
    expect(getCloudPlanFromProduct(undefined)).toBe("unknown");
    expect(getCloudPlanFromProduct("prod_unknown")).toBe("unknown");
    expect(getCloudPlanFromProduct(product({ id: "prod_unknown", metadata: {} }))).toBe("unknown");
    expect(
      getCloudPlanFromProduct(product({ id: "prod_unknown", metadata: { formbricks_plan: "enterprise" } }))
    ).toBe("unknown");
  });
});
