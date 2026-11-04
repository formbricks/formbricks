import { beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";
import { getDashboardsUnavailable } from "./dashboards-unavailable";

/**
 * A Dashboard viewer sees dashboards and nothing of the organization's plan (ADR-0023). These layouts
 * render client components, so whatever their data carries reaches the viewer's browser: the props are
 * read here against real PostgreSQL to show no Stripe id, subscription, limit or response count is in
 * them.
 */

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () => ({ user: { id: session.userId } })),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_FORMBRICKS_CLOUD: true,
}));
vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: vi.fn(async () => ({ active: true, features: { isMultiOrgEnabled: true } })),
}));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  // A lapsed plan, so the unavailable page renders rather than redirecting to a dashboard.
  getIsDashboardViewerRoleEnabled: vi.fn(async () => false),
  getIsMultiOrgEnabled: vi.fn(async () => true),
  getAccessControlPermission: vi.fn(async () => false),
  getOrganizationWorkspacesLimit: vi.fn(async () => 3),
}));

const SECRETS = ["cus_viewer_secret", "sub_viewer_secret", "price_viewer_secret", "987654"];

let organizationId = "";
let viewerId = "";
let ownerId = "";

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({
    data: {
      name: "Plan Org",
      billing: {
        create: {
          stripeCustomerId: SECRETS[0],
          limits: { workspaces: 7, monthly: { responses: 987_654, workflowRuns: null } },
          usageCycleAnchor: new Date("2026-01-01"),
          stripe: { subscriptionId: SECRETS[1], priceId: SECRETS[2] },
        },
      },
    },
  });
  organizationId = organization.id;
  const [viewer, owner] = await Promise.all([
    prisma.user.create({ data: { email: "viewer@plan.test", name: "Viewer" } }),
    prisma.user.create({ data: { email: "owner@plan.test", name: "Owner" } }),
  ]);
  viewerId = viewer.id;
  ownerId = owner.id;
  await prisma.membership.createMany({
    data: [
      { accepted: true, organizationId, role: "dashboard_viewer", userId: viewerId },
      { accepted: true, organizationId, role: "owner", userId: ownerId },
    ],
  });
});

const expectNoPlanDetail = (props: unknown) => {
  const serialized = JSON.stringify(props);
  for (const secret of SECRETS) expect(serialized).not.toContain(secret);
};

describe("the Dashboard viewer's unavailable page", () => {
  test("sends only the organization's id and name", async () => {
    const page = await getDashboardsUnavailable(viewerId, organizationId);

    expect(page.kind).toBe("show");
    if (page.kind !== "show") return;
    expect(page.organization).toEqual({ id: organizationId, name: "Plan Org" });
    expect(page.isRoleEnabled).toBe(false);
    expectNoPlanDetail(page);
  });

  test("is a 404 for anyone who is not a viewer there", async () => {
    await expect(getDashboardsUnavailable(ownerId, organizationId)).resolves.toEqual({ kind: "notFound" });
  });
});

describe("the settings layout", () => {
  test("carries no Stripe field and no Cloud response count for a viewer", async () => {
    session.userId = viewerId;
    const data = await getSettingsLayoutData(viewerId, organizationId);

    expect(data?.organization.billing.stripeCustomerId).toBeNull();
    expect(data?.organization.billing.stripe).toBeUndefined();
    expect(data?.responseCount).toBe(0);
    expectNoPlanDetail(data);
  });

  test("still carries the plan for an owner, who manages it", async () => {
    session.userId = ownerId;
    const data = await getSettingsLayoutData(ownerId, organizationId);

    expect(data?.organization.billing.stripeCustomerId).toBe(SECRETS[0]);
  });
});
