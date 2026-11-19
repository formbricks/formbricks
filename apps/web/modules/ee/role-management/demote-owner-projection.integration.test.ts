import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { getAuthzedClient } from "@/lib/authzed/client";
import { createApiKeyAction } from "@/modules/organization/settings/api-keys/actions";
import { updateMembershipAction } from "./actions";

/**
 * Demoting an owner takes the rights the role gave away in SpiceDB as soon as the change commits
 * (ENG-7282), through the real server actions against real PostgreSQL and SpiceDB. The harness runs no
 * outbox worker, so what the test sees is what the action itself projected.
 */

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () =>
    session.userId ? { user: { id: session.userId }, expires: "2099-01-01T00:00:00.000Z" } : null
  ),
}));

// Request metadata reads `headers()`, which only exists inside a Next request.
vi.mock("@/modules/ee/audit-logs/lib/request-metadata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/request-metadata")>();
  return { ...actual, getAuditRequestMetadata: vi.fn(async () => actual.UNKNOWN_AUDIT_REQUEST_METADATA) };
});

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getAccessControlPermission: vi.fn(async () => true),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => true),
}));

const ids = { organization: "", owner: "", demoted: "", workspace: "", team: "" };

const as = (userId: string) => {
  session.userId = userId;
};

/** The relations SpiceDB holds for the demoted user on a resource, read straight from the graph. */
const relationsOf = async (resourceType: "organization" | "team", resourceId: string) =>
  (
    await getAuthzedClient().readRelationships({
      filter: { resourceType, resourceId, subject: { objectType: "user", objectId: ids.demoted } },
      limit: 10,
    })
  ).relationships.map(({ relation }) => relation);

const mintApiKey = () =>
  createApiKeyAction({
    organizationId: ids.organization,
    apiKeyData: {
      label: "key minted after demotion",
      workspaceAccess: [{ workspaceId: ids.workspace, permission: "manage" }],
      organizationAccess: { accessControl: { read: true, write: true } },
    },
  } as never);

beforeEach(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Demotion Org" } });
  ids.organization = organization.id;
  const workspace = await prisma.workspace.create({ data: { name: "W", organizationId: organization.id } });
  ids.workspace = workspace.id;

  const owner = async (label: string) => {
    const created = await prisma.user.create({ data: { email: `${label}@demote.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role: "owner", userId: created.id },
    });
    return created.id;
  };
  ids.owner = await owner("owner");
  ids.demoted = await owner("demoted");

  // An owner is a team admin in every team they are on.
  const team = await prisma.team.create({ data: { name: "Field", organizationId: organization.id } });
  ids.team = team.id;
  await prisma.teamUser.create({ data: { teamId: team.id, userId: ids.demoted, role: "admin" } });

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

/**
 * Owner A demotes the other owner, and asserts the outbox has not delivered that change yet: what SpiceDB
 * holds afterwards is what the action projected itself.
 */
const demote = async (role: "member" | "dashboard_viewer") => {
  as(ids.owner);
  const demotion = await updateMembershipAction({
    organizationId: ids.organization,
    userId: ids.demoted,
    data: { role },
  });
  expect(demotion?.serverError).toBeUndefined();

  // The fixture drained everything before it, so an undelivered event for this membership is the demotion's.
  const undelivered = await prisma.authzedProjectionOutbox.count({
    where: {
      targetType: "membership",
      primaryId: ids.organization,
      secondaryId: ids.demoted,
      processedAt: null,
    },
  });
  expect(undelivered).toBeGreaterThan(0);
};

describe("demoting an owner", () => {
  test("an owner demoted to Member loses the owner relation and can't mint an API key, before the outbox delivers", async () => {
    await demote("member");

    expect(await relationsOf("organization", ids.organization)).toEqual(["member"]);
    as(ids.demoted);
    expect((await mintApiKey())?.serverError).toBeDefined();
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  // Its own case: a demotion to Dashboard viewer also turns team admin into contributor, which only the
  // team projection carries to SpiceDB.
  test("an owner demoted to Dashboard viewer stops being a team admin and can't mint an API key, before the outbox delivers", async () => {
    await demote("dashboard_viewer");

    expect(await relationsOf("organization", ids.organization)).toEqual(["dashboard_viewer"]);
    expect(await relationsOf("team", ids.team)).toEqual(["contributor"]);
    as(ids.demoted);
    expect((await mintApiKey())?.serverError).toBeDefined();
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  test("the owner who stays can still mint an API key", async () => {
    await demote("member");

    as(ids.owner);
    expect((await mintApiKey())?.serverError).toBeUndefined();
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(1);
  });
});
