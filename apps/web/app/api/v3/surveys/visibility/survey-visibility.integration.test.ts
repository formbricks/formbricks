import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { getAuthzedClient } from "@/lib/authzed/client";
import { drainAuthzedOutbox } from "@/lib/authzed/outbox-processor";
import { readAllRelationships } from "@/lib/authzed/relationship-reads";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { lockSurveyVisibility } from "@/lib/authzed/survey";
import { expectedSurveyRelationships } from "@/lib/authzed/survey-relationships";
import { listV3Surveys } from "../lib/operations";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "./operations";

/**
 * ENG-3282, Gate D: the visibility endpoint and the survey list against a real PostgreSQL and SpiceDB,
 * with the readiness marker set.
 *
 * - fencing: a projector holding the per-survey lock cannot be overtaken — the POST waits for it, and
 *   the graph ends up describing the final row;
 * - a grant whose in-request projection fails answers 503 and shows `pending: "workspace"`, and the
 *   outbox then finishes it;
 * - the list shows each principal exactly the surveys it may read, pending ones included.
 */

// The RBAC entitlement is a licence check; this suite is about enforcement, so it is granted.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getAccessControlPermission: vi.fn(async () => true),
}));

// Lets one test make the in-request fast path fail while the outbox keeps the real projector.
const projection = vi.hoisted(() => ({ failNext: false }));
vi.mock("@/lib/authzed/survey", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authzed/survey")>();
  return {
    ...actual,
    reconcileSurveyRelationships: async (surveyIds: ReadonlyArray<string>) => {
      if (projection.failNext) {
        projection.failNext = false;
        return { attempts: 3, code: "authzed_unavailable", retryable: true, status: "failed" } as const;
      }
      return actual.reconcileSurveyRelationships(surveyIds);
    },
  };
});

const ids = { apiKey: "", manager: "", member: "", organization: "", owner: "", workspace: "" };
const session = (userId: string) => ({ expires: "2099-01-01", user: { id: userId } }) as never;
const apiKeyAuthentication = () =>
  ({
    apiKeyId: ids.apiKey,
    organizationAccess: { accessControl: { read: false, write: false } },
    organizationId: ids.organization,
    type: "apiKey",
    workspacePermissions: [{ permission: "manage", workspaceId: ids.workspace }],
  }) as never;

const instance = "/api/v3/surveys";

const post = (surveyId: string, visibility: "private" | "workspace", userId = ids.owner) =>
  changeV3SurveyVisibility({
    authentication: session(userId),
    body: { visibility },
    instance,
    requestId: "req",
    surveyId,
  });

const graphEdges = async (surveyId: string) =>
  (
    await readAllRelationships(getAuthzedClient(), { resourceId: surveyId, resourceType: "survey" })
  ).relationships
    .map(({ relation, subject }) => `${relation}@${subject.objectType}:${subject.objectId}`)
    .sort();

const expectedEdges = async (surveyId: string) => {
  const row = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { id: true, ownerId: true, visibility: true, visibilityVersion: true, workspaceId: true },
  });
  return expectedSurveyRelationships(row)
    .map(({ relation, subject }) => `${relation}@${subject.objectType}:${subject.objectId}`)
    .sort();
};

const listedIds = async (authentication: never) => {
  const response = await listV3Surveys({
    authentication,
    instance,
    requestId: "req",
    searchParams: new URLSearchParams({ workspaceId: ids.workspace }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: Array<{ id: string }>; meta: { totalCount: number } };
  return { ids: body.data.map(({ id }) => id).sort(), totalCount: body.meta.totalCount };
};

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Visibility API Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Visibility API", organizationId: organization.id },
  });
  ids.organization = organization.id;
  ids.workspace = workspace.id;

  const makeUser = async (label: string, role: "manager" | "member", permission?: "read" | "readWrite") => {
    const user = await prisma.user.create({ data: { email: `${label}@visibility-api.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: user.id },
    });
    if (permission) {
      const team = await prisma.team.create({ data: { name: label, organizationId: organization.id } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
      await prisma.workspaceTeam.create({ data: { permission, teamId: team.id, workspaceId: workspace.id } });
    }
    return user.id;
  };
  ids.owner = await makeUser("owner", "member", "readWrite");
  ids.member = await makeUser("member", "member", "read");
  ids.manager = await makeUser("manager", "manager");

  const apiKey = await prisma.apiKey.create({
    data: { hashedKey: "visibility-api-hash", label: "key", organizationId: organization.id },
  });
  await prisma.apiKeyWorkspace.create({
    data: { apiKeyId: apiKey.id, permission: "manage", workspaceId: workspace.id },
  });
  ids.apiKey = apiKey.id;

  await synchronizeAuthzedIntegrationFixture();
  await setProjectionScopeReady("survey", "integration");
}, 120_000);

beforeEach(async () => {
  resetSurveyVisibilityReadinessMemo();
  projection.failNext = false;
  await prisma.survey.deleteMany({ where: { workspaceId: ids.workspace } });
  await drainAuthzedOutbox();
});

afterAll(async () => {
  await clearProjectionScopeReady("survey");
  resetSurveyVisibilityReadinessMemo();
});

const createSurvey = async (name: string, visibility: "private" | "workspace" = "workspace") => {
  const survey = await prisma.survey.create({
    data: { name, ownerId: ids.owner, visibility, workspaceId: ids.workspace },
  });
  await drainAuthzedOutbox();
  return survey.id;
};

describe("POST …/visibility against the real stack", () => {
  test("waits for a projector holding the survey's lock, and the graph ends on the final row", async () => {
    const surveyId = await createSurvey("Fenced");

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let lockTaken!: () => void;
    const taken = new Promise<void>((resolve) => {
      lockTaken = resolve;
    });
    const projector = prisma.$transaction(
      async (tx) => {
        await lockSurveyVisibility(tx, surveyId);
        lockTaken();
        await held;
      },
      { timeout: 20_000 }
    );
    await taken;

    let settled = false;
    const request = post(surveyId, "private").then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(settled).toBe(false);

    release();
    await projector;
    const response = await request;

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ pending: null, visibility: "private" });
    expect(await graphEdges(surveyId)).toEqual(await expectedEdges(surveyId));
  });

  test("a grant the graph did not take in-request answers 503, and the outbox finishes it", async () => {
    const surveyId = await createSurvey("Grant", "private");
    projection.failNext = true;

    const response = await post(surveyId, "workspace");
    expect(response.status).toBe(503);

    const pending = await getV3SurveyVisibility({
      authentication: session(ids.owner),
      instance,
      requestId: "req",
      surveyId,
    });
    expect((await pending.json()).data).toMatchObject({ pending: "workspace", visibility: "private" });

    await drainAuthzedOutbox();

    const settled = await getV3SurveyVisibility({
      authentication: session(ids.owner),
      instance,
      requestId: "req",
      surveyId,
    });
    expect((await settled.json()).data).toMatchObject({ pending: null, visibility: "workspace" });
  });

  test("a restriction is enforced at once even when its projection fails", async () => {
    const surveyId = await createSurvey("Restriction");
    projection.failNext = true;

    const response = await post(surveyId, "private");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ pending: "private", visibility: "private" });
    expect((await listedIds(session(ids.member))).ids).not.toContain(surveyId);
  });

  test("refuses the same change from a read member, and from an API key", async () => {
    const surveyId = await createSurvey("Refused");

    expect((await post(surveyId, "private", ids.member)).status).toBe(403);
    const byKey = await changeV3SurveyVisibility({
      authentication: apiKeyAuthentication(),
      body: { visibility: "private" },
      instance,
      requestId: "req",
      surveyId,
    });
    expect(byKey.status).toBe(403);
  });
});

describe("GET /api/v3/surveys scoping", () => {
  test("each principal sees exactly what it may read, and counts exactly that", async () => {
    const visible = await createSurvey("Visible");
    const hidden = await createSurvey("Hidden", "private");
    const pendingGrant = await createSurvey("Pending grant", "private");
    await prisma.survey.update({
      where: { id: pendingGrant },
      data: { visibility: "workspace", visibilityVersion: { increment: 1 } },
    });
    await prisma.$executeRawUnsafe('TRUNCATE "AuthzedProjectionOutbox";');

    expect(await listedIds(session(ids.owner))).toEqual({
      ids: [visible, hidden, pendingGrant].sort(),
      totalCount: 3,
    });
    expect(await listedIds(session(ids.manager))).toEqual({
      ids: [visible, hidden, pendingGrant].sort(),
      totalCount: 3,
    });
    // A pending grant is still private to everyone but its owner and the administrators.
    expect(await listedIds(session(ids.member))).toEqual({ ids: [visible], totalCount: 1 });
    expect(await listedIds(apiKeyAuthentication())).toEqual({ ids: [visible], totalCount: 1 });
  });
});
