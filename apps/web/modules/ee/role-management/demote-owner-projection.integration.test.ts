import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { POST as createApiKeyRoute } from "@/app/api/internal/api-keys/route";
import { PATCH as updateMemberRoute } from "@/app/api/internal/members/[userId]/route";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { getAuthzedClient } from "@/lib/authzed/client";

/**
 * Demoting an owner takes the rights the role gave away in SpiceDB as soon as the change commits
 * (ENG-7282), through the real internal routes against real PostgreSQL and SpiceDB. The harness runs no
 * outbox worker, so what the test sees is what the route itself projected.
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

/** A session write to an internal route, as the dashboard sends it (same-origin, JSON). */
const send = (
  handler: (req: NextRequest, context: never) => Promise<Response>,
  url: string,
  method: "PATCH" | "POST",
  body: unknown,
  params: Record<string, string> = {}
) =>
  handler(
    new NextRequest(`http://localhost${url}`, {
      method,
      headers: { ...SAME_ORIGIN_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(params) } as never
  );

/** The relations SpiceDB holds for the demoted user on a resource, read straight from the graph. */
const relationsOf = async (resourceType: "organization" | "team", resourceId: string) =>
  (
    await getAuthzedClient().readRelationships({
      filter: { resourceType, resourceId, subject: { objectType: "user", objectId: ids.demoted } },
      limit: 10,
    })
  ).relationships.map(({ relation }) => relation);

/** Mints an organization-manage key, as the API keys page does; answers the route's status. */
const mintApiKey = async () =>
  (
    await send(createApiKeyRoute, `/api/internal/api-keys?organizationId=${ids.organization}`, "POST", {
      label: "key minted after demotion",
      workspacePermissions: [{ workspaceId: ids.workspace, permission: "manage" }],
      organizationAccess: { accessControl: { read: true, write: true } },
    })
  ).status;

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
 * holds afterwards is what the route projected itself.
 */
const demote = async (role: "member" | "dashboard_viewer") => {
  as(ids.owner);
  const demotion = await send(
    updateMemberRoute,
    `/api/internal/members/${ids.demoted}?organizationId=${ids.organization}`,
    "PATCH",
    { role },
    { userId: ids.demoted }
  );
  expect(demotion.status, await demotion.clone().text()).toBe(200);

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
    expect(await mintApiKey()).toBe(403);
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  // Its own case: a demotion to Dashboard viewer also turns team admin into contributor, which only the
  // team projection carries to SpiceDB.
  test("an owner demoted to Dashboard viewer stops being a team admin and can't mint an API key, before the outbox delivers", async () => {
    await demote("dashboard_viewer");

    expect(await relationsOf("organization", ids.organization)).toEqual(["dashboard_viewer"]);
    expect(await relationsOf("team", ids.team)).toEqual(["contributor"]);
    as(ids.demoted);
    expect(await mintApiKey()).toBe(403);
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  test("the owner who stays can still mint an API key", async () => {
    await demote("member");

    as(ids.owner);
    expect(await mintApiKey()).toBe(201);
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(1);
  });
});
