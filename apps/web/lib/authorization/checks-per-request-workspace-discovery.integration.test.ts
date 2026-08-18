import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { resetDb } from "@/integration/reset-db";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "./context";

const lookupResources = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authzed/client", () => ({
  getAuthzedClient: () => ({ lookupResources }),
}));
vi.mock("@/lib/authzed/outbox-freshness", () => ({
  assertAuthzedProjectionFreshness: vi.fn(),
}));

const scenario = { organizationId: "", userId: "" };

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({
    data: { name: "Workspace Discovery Checks Org" },
  });
  const user = await prisma.user.create({
    data: { email: "workspace-discovery-checks@test.local", name: "Discovery Owner" },
  });
  await prisma.membership.create({
    data: { accepted: true, organizationId: organization.id, role: "owner", userId: user.id },
  });

  scenario.organizationId = organization.id;
  scenario.userId = user.id;
}, 120_000);

beforeEach(() => {
  lookupResources.mockImplementation(async () => ({
    resourceIds: (
      await prisma.workspace.findMany({
        where: { organizationId: scenario.organizationId },
        select: { id: true },
      })
    ).map(({ id }) => id),
  }));
});

const listAndCount = async (): Promise<Readonly<{ checksIssued: number; workspaceCount: number }>> =>
  withAuthorizationSurface("mcp", async () => {
    const response = await listV3Workspaces({
      authentication: {
        expires: "2027-01-01T00:00:00.000Z",
        user: { id: scenario.userId },
      } as never,
      instance: "/api/mcp",
      requestId: "workspace-discovery-check-count",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: ReadonlyArray<unknown> };
    return {
      checksIssued: getIssuedAuthorizationCheckCount() ?? -1,
      workspaceCount: body.data.length,
    };
  });

describe("MCP workspace discovery authorization amplification, against a real database", () => {
  test("one and one hundred workspaces each produce exactly one central operation", async () => {
    await prisma.workspace.create({
      data: { name: "Discovery Workspace 1", organizationId: scenario.organizationId },
    });
    const small = await listAndCount();

    await prisma.workspace.createMany({
      data: Array.from({ length: 99 }, (_unused, index) => ({
        name: `Discovery Workspace ${index + 2}`,
        organizationId: scenario.organizationId,
      })),
    });
    const large = await listAndCount();

    expect(small.workspaceCount).toBe(1);
    expect(large.workspaceCount).toBe(100);
    // Positive assertions prevent an accidentally disconnected counter from making the growth check
    // pass vacuously at zero.
    expect(small.checksIssued).toBeGreaterThan(0);
    expect(large.checksIssued).toBeGreaterThan(0);
    expect(small.checksIssued).toBe(1);
    expect(large.checksIssued - small.checksIssued).toBe(0);
  });
});
