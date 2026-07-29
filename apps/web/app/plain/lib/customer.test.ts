import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getIsActiveCustomer } from "./customer";

// A getter lets each test flip the deployment flag at runtime — the helper reads it through a live
// import binding at call time. Cloud is the default since that is where the label is used.
const constantsOverrides = vi.hoisted(() => ({ IS_FORMBRICKS_CLOUD: true }));

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return constantsOverrides.IS_FORMBRICKS_CLOUD;
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsByUserId: vi.fn(),
}));

const orgWith = (plan: string | null, subscriptionStatus: string | null) =>
  ({ billing: { stripe: { plan, subscriptionStatus } } }) as unknown as Awaited<
    ReturnType<typeof getOrganizationsByUserId>
  >[number];

const mockOrgs = (orgs: unknown[]) =>
  vi
    .mocked(getOrganizationsByUserId)
    .mockResolvedValue(orgs as Awaited<ReturnType<typeof getOrganizationsByUserId>>);

describe("getIsActiveCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
  });

  test("returns true for a paid plan with an active subscription", async () => {
    mockOrgs([orgWith("pro", "active")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(true);
  });

  test("returns true for a paid plan on trial", async () => {
    mockOrgs([orgWith("scale", "trialing")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(true);
  });

  test("returns false for a paid plan whose subscription is not active", async () => {
    mockOrgs([orgWith("pro", "canceled")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
  });

  test("returns false for the hobby plan even when the subscription is active", async () => {
    mockOrgs([orgWith("hobby", "active")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
  });

  test("returns false for the custom plan (not counted as paying)", async () => {
    mockOrgs([orgWith("custom", "active")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
  });

  test("returns false when the organization has no stripe billing", async () => {
    mockOrgs([{ billing: { stripe: null } }]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
  });

  test("returns true when at least one of several organizations qualifies", async () => {
    mockOrgs([orgWith("hobby", "active"), orgWith("scale", "active")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(true);
  });

  test("returns false when the user has no organizations", async () => {
    mockOrgs([]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
  });

  test("returns false on self-hosted instances without querying organizations", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = false;
    mockOrgs([orgWith("scale", "active")]);
    await expect(getIsActiveCustomer("user-1")).resolves.toBe(false);
    expect(getOrganizationsByUserId).not.toHaveBeenCalled();
  });
});
