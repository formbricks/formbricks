import { describe, expect, test } from "vitest";
import { CLOUD_STRIPE_PRODUCT_IDS, getCloudPlanFromProductId } from "./stripe-catalog";

describe("stripe catalog mapping", () => {
  test("maps known product IDs to cloud plans", () => {
    expect(getCloudPlanFromProductId(CLOUD_STRIPE_PRODUCT_IDS.HOBBY)).toBe("hobby");
    expect(getCloudPlanFromProductId(CLOUD_STRIPE_PRODUCT_IDS.PRO)).toBe("pro");
    expect(getCloudPlanFromProductId(CLOUD_STRIPE_PRODUCT_IDS.SCALE)).toBe("scale");
    expect(getCloudPlanFromProductId(CLOUD_STRIPE_PRODUCT_IDS.TRIAL)).toBe("trial");
  });

  test("falls back to unknown for unknown product ID", () => {
    expect(getCloudPlanFromProductId(null)).toBe("unknown");
    expect(getCloudPlanFromProductId(undefined)).toBe("unknown");
    expect(getCloudPlanFromProductId("prod_unknown")).toBe("unknown");
  });
});
