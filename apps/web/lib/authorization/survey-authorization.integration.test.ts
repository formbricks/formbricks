import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { type TAuthorizationActor, can } from "@/lib/authorization";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";

/**
 * ENG-3282: survey and response decisions against a real PostgreSQL and SpiceDB, for the contract's
 * permission matrix (§8), with the readiness marker off and on.
 *
 * Principals: the survey's owner (readWrite through a team), an organization manager with no team,
 * a plain member with read through a team, a team-manage member (R-10), and a manage-level API key.
 */
const ids = {
  apiKey: "",
  manager: "",
  member: "",
  orgOwner: "",
  owner: "",
  ownedPrivateSurvey: "",
  pendingRestrictionSurvey: "",
  pendingSurvey: "",
  privateResponse: "",
  privateSurvey: "",
  teamManager: "",
  visibleSurvey: "",
  workspace: "",
};

const user = (id: string): TAuthorizationActor => ({ id, type: "user" });

const readSurvey = (actor: TAuthorizationActor, surveyId: string) =>
  can(actor, "survey.read", { id: surveyId, type: "survey" });

const setMarker = async (ready: boolean): Promise<void> => {
  await (ready ? setProjectionScopeReady("survey", "integration") : clearProjectionScopeReady("survey"));
  resetSurveyVisibilityReadinessMemo();
};

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Visibility Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Visibility Workspace", organizationId: organization.id },
  });

  const makeUser = async (label: string, role: "manager" | "member" | "owner") => {
    const created = await prisma.user.create({ data: { email: `${label}@visibility.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: created.id },
    });
    return created.id;
  };
  const grantTeam = async (label: string, userId: string, permission: "manage" | "read" | "readWrite") => {
    const team = await prisma.team.create({ data: { name: label, organizationId: organization.id } });
    await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId } });
    await prisma.workspaceTeam.create({ data: { permission, teamId: team.id, workspaceId: workspace.id } });
  };

  ids.owner = await makeUser("owner", "member");
  ids.manager = await makeUser("manager", "manager");
  ids.orgOwner = await makeUser("org-owner", "owner");
  ids.member = await makeUser("member", "member");
  ids.teamManager = await makeUser("team-manager", "member");
  await grantTeam("Writers", ids.owner, "readWrite");
  await grantTeam("Readers", ids.member, "read");
  await grantTeam("Managers", ids.teamManager, "manage");

  const apiKey = await prisma.apiKey.create({
    data: { hashedKey: "integration-hash", label: "Visibility key", organizationId: organization.id },
  });
  await prisma.apiKeyWorkspace.create({
    data: { apiKeyId: apiKey.id, permission: "manage", workspaceId: workspace.id },
  });
  ids.apiKey = apiKey.id;
  ids.workspace = workspace.id;

  const survey = (name: string, visibility: "restricted" | "workspace") =>
    prisma.survey.create({ data: { name, ownerId: ids.owner, visibility, workspaceId: workspace.id } });
  ids.visibleSurvey = (await survey("Visible", "workspace")).id;
  ids.privateSurvey = (await survey("Restricted", "restricted")).id;
  ids.pendingSurvey = (await survey("Pending grant", "restricted")).id;
  ids.pendingRestrictionSurvey = (await survey("Pending restriction", "workspace")).id;
  ids.ownedPrivateSurvey = (
    await prisma.survey.create({
      data: {
        name: "Team manager's restricted survey",
        ownerId: ids.teamManager,
        visibility: "restricted",
        workspaceId: workspace.id,
      },
    })
  ).id;
  ids.privateResponse = (
    await prisma.response.create({ data: { data: {}, finished: true, surveyId: ids.privateSurvey } })
  ).id;

  await synchronizeAuthzedIntegrationFixture();

  // A grant stored but not yet acknowledged: the graph still says restricted, PostgreSQL says workspace.
  await prisma.survey.update({
    where: { id: ids.pendingSurvey },
    data: { visibility: "workspace", visibilityVersion: { increment: 1 } },
  });
  // A restriction must take effect even while the graph still grants workspace access.
  await prisma.survey.update({
    where: { id: ids.pendingRestrictionSurvey },
    data: { visibility: "restricted", visibilityVersion: { increment: 1 } },
  });
  await prisma.$executeRawUnsafe('TRUNCATE "AuthzedProjectionOutbox";');
}, 120_000);

afterAll(async () => {
  await setMarker(false);
});

describe("marker off: exactly the workspace ladder, as before ENG-3282", () => {
  beforeAll(() => setMarker(false));

  test("every workspace reader reads every survey, restricted or not", async () => {
    for (const surveyId of [ids.visibleSurvey, ids.privateSurvey, ids.pendingSurvey]) {
      await expect(readSurvey(user(ids.member), surveyId)).resolves.toBe(true);
      await expect(readSurvey({ id: ids.apiKey, type: "apiKey" }, surveyId)).resolves.toBe(true);
    }
    await expect(
      can(user(ids.member), "response.read", { id: ids.privateResponse, type: "response" })
    ).resolves.toBe(true);
  });

  test("nobody may change visibility while it is not enforced", async () => {
    await expect(
      can(user(ids.manager), "survey.change_visibility", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(false);
  });

  test("survey manage follows the workspace manage ladder while visibility is not enforced", async () => {
    for (const surveyId of [ids.visibleSurvey, ids.privateSurvey, ids.pendingSurvey]) {
      await expect(
        can(user(ids.teamManager), "survey.manage", { id: surveyId, type: "survey" })
      ).resolves.toBe(true);
      await expect(can(user(ids.owner), "survey.manage", { id: surveyId, type: "survey" })).resolves.toBe(
        false
      );
    }
  });
});

describe("marker on: the contract's permission matrix", () => {
  beforeAll(() => setMarker(true));

  test.each([
    ["owner", () => user(ids.owner), true, true],
    ["organization manager", () => user(ids.manager), true, true],
    ["read member", () => user(ids.member), true, false],
    ["team-level manager (R-10)", () => user(ids.teamManager), true, false],
    ["API key (K-1)", (): TAuthorizationActor => ({ id: ids.apiKey, type: "apiKey" }), true, false],
  ] as const)("%s", async (_label, actor, readsVisible, readsPrivate) => {
    await expect(readSurvey(actor(), ids.visibleSurvey)).resolves.toBe(readsVisible);
    await expect(readSurvey(actor(), ids.privateSurvey)).resolves.toBe(readsPrivate);
    await expect(can(actor(), "response.read", { id: ids.privateResponse, type: "response" })).resolves.toBe(
      readsPrivate
    );
    // A pending grant is still restricted to everyone but owner and administrators.
    await expect(readSurvey(actor(), ids.pendingSurvey)).resolves.toBe(readsPrivate);
  });

  test("the owner keeps their own ladder: readWrite does not become manage by owning a survey", async () => {
    await expect(
      can(user(ids.owner), "survey.write", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(true);
    await expect(
      can(user(ids.owner), "survey.manage", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(false);
  });

  test.each([
    ["organization owner", () => user(ids.orgOwner), true, true],
    ["organization manager", () => user(ids.manager), true, true],
    ["team-level manager", () => user(ids.teamManager), true, false],
    ["readWrite survey owner", () => user(ids.owner), false, false],
    ["read member", () => user(ids.member), false, false],
  ] as const)(
    "survey manage for %s respects visibility and pending changes",
    async (_label, actor, shared, restricted) => {
      await expect(can(actor(), "survey.manage", { id: ids.visibleSurvey, type: "survey" })).resolves.toBe(
        shared
      );
      for (const surveyId of [ids.privateSurvey, ids.pendingSurvey, ids.pendingRestrictionSurvey]) {
        await expect(can(actor(), "survey.manage", { id: surveyId, type: "survey" })).resolves.toBe(
          restricted
        );
      }
    }
  );

  test("an owner with workspace manage retains survey manage while restricted or pending", async () => {
    await expect(
      can(user(ids.teamManager), "survey.manage", { id: ids.ownedPrivateSurvey, type: "survey" })
    ).resolves.toBe(true);

    await prisma.survey.update({
      where: { id: ids.ownedPrivateSurvey },
      data: { visibility: "workspace", visibilityVersion: { increment: 1 } },
    });
    await expect(
      can(user(ids.teamManager), "survey.manage", { id: ids.ownedPrivateSurvey, type: "survey" })
    ).resolves.toBe(true);
  });

  test("change_visibility is the owner or an administrator, never write, team manage, or a key", async () => {
    const changeVisibility = (actor: TAuthorizationActor, surveyId: string) =>
      can(actor, "survey.change_visibility", { id: surveyId, type: "survey" });

    await expect(changeVisibility(user(ids.owner), ids.visibleSurvey)).resolves.toBe(true);
    await expect(changeVisibility(user(ids.manager), ids.privateSurvey)).resolves.toBe(true);
    await expect(changeVisibility(user(ids.owner), ids.pendingSurvey)).resolves.toBe(true);
    await expect(changeVisibility(user(ids.teamManager), ids.visibleSurvey)).resolves.toBe(false);
    await expect(changeVisibility(user(ids.member), ids.visibleSurvey)).resolves.toBe(false);
    await expect(changeVisibility({ id: ids.apiKey, type: "apiKey" }, ids.visibleSurvey)).resolves.toBe(
      false
    );
  });

  test("a single survey decision costs one authorization check, pending or not", async () => {
    for (const surveyId of [ids.privateSurvey, ids.pendingSurvey]) {
      const checks = await withAuthorizationSurface("page", async () => {
        await readSurvey(user(ids.member), surveyId);
        return getIssuedAuthorizationCheckCount();
      });
      expect(checks).toBe(1);
    }
  });

  test("an owner who loses workspace access loses their restricted survey", async () => {
    await prisma.teamUser.deleteMany({ where: { userId: ids.owner } });
    await synchronizeAuthzedIntegrationFixture();
    await expect(readSurvey(user(ids.owner), ids.privateSurvey)).resolves.toBe(false);
    await expect(
      can(user(ids.owner), "survey.change_visibility", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(false);
  });
});
