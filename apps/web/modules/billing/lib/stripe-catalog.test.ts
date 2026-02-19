import { describe, expect, test } from "vitest";
import {
  CLOUD_STRIPE_PRODUCT_IDS,
  getCloudPlanFromProductId,
  getLegacyPlanFromCloudPlan,
  getLimitsFromCloudPlan,
} from "./stripe-catalog";

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

  test("maps cloud plan to legacy plan for backward compatibility", () => {
    expect(getLegacyPlanFromCloudPlan("hobby")).toBe("free");
    expect(getLegacyPlanFromCloudPlan("pro")).toBe("startup");
    expect(getLegacyPlanFromCloudPlan("trial")).toBe("startup");
    expect(getLegacyPlanFromCloudPlan("scale")).toBe("custom");
    expect(getLegacyPlanFromCloudPlan("unknown")).toBe("free");
  });

  test("returns plan-specific limits", () => {
    expect(getLimitsFromCloudPlan("hobby")).toEqual({ projects: 1, responses: 250, contacts: null });
    expect(getLimitsFromCloudPlan("pro")).toEqual({ projects: 3, responses: 2000, contacts: 5000 });
    expect(getLimitsFromCloudPlan("trial")).toEqual({ projects: 3, responses: 2000, contacts: 5000 });
    expect(getLimitsFromCloudPlan("scale")).toEqual({ projects: 5, responses: 5000, contacts: 10000 });
    expect(getLimitsFromCloudPlan("unknown")).toEqual({ projects: 1, responses: 250, contacts: null });
  });
});
