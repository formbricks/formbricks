import { describe, expect, test } from "vitest";
import { withPlanDetailsFor } from "./plan-details";

const organization = {
  id: "org1",
  name: "Acme",
  billing: {
    stripeCustomerId: "cus_123",
    limits: { workspaces: 9, monthly: { responses: 50_000, workflowRuns: 10 } },
    usageCycleAnchor: new Date("2026-01-01"),
    stripe: { plan: "custom", subscriptionId: "sub_1" } as never,
  },
};

describe("withPlanDetailsFor", () => {
  test("a Dashboard viewer gets no Stripe id, subscription, usage cycle or real limits", () => {
    const result = withPlanDetailsFor("dashboard_viewer", organization);
    expect(result.id).toBe("org1");
    expect(result.billing.stripeCustomerId).toBeNull();
    expect(result.billing.usageCycleAnchor).toBeNull();
    expect(result.billing.stripe).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/cus_123|sub_1|50000/);
  });

  test("everyone else keeps the organization's billing, with a missing Stripe block as undefined", () => {
    for (const role of ["owner", "manager", "member", "billing", undefined] as const) {
      expect(withPlanDetailsFor(role, organization).billing).toEqual(organization.billing);
    }
    const noStripe = { ...organization, billing: { ...organization.billing, stripe: null } };
    expect(withPlanDetailsFor("owner", noStripe).billing.stripe).toBeUndefined();
  });
});
