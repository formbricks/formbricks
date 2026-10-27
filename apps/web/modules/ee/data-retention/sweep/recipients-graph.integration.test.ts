import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { changeV3SurveyVisibility } from "@/app/api/v3/surveys/visibility/operations";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { filterReadableSurveyIds } from "@/lib/authorization/resource-list";
import { drainAuthzedOutbox } from "@/lib/authzed/outbox-processor";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { resolveSurveyNoticeRecipients } from "./recipients";

/**
 * Notice recipients against a real PostgreSQL and SpiceDB (ENG-3612): the app's own survey read check
 * (`filterReadableSurveyIds`, the graph) together with the effective-visibility rule.
 *
 * The restriction is stored through the real visibility endpoint with its in-request projection failing,
 * so the survey is restricted in PostgreSQL while the graph still says workspace-visible — the window
 * the outbox closes within its delivery window, and the one the graph alone would get wrong.
 */

// The RBAC entitlement is a licence check; changing visibility needs it, so it is granted.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getAccessControlPermission: vi.fn(async () => true),
}));

// Lets the test make the endpoint's in-request projection fail; the backfill and the outbox keep the real
// projector.
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

const ids = { organization: "", workspace: "", yan: "", ada: "", olive: "", bob: "", carl: "", mia: "" };
const surveys = { owned: "", byBob: "", byMia: "", byCarl: "" };

const recipientsByName = async () => {
  const notice = [
    { id: surveys.owned, ownerId: ids.ada, createdBy: ids.bob },
    { id: surveys.byBob, ownerId: ids.olive, createdBy: ids.bob },
    { id: surveys.byMia, ownerId: ids.olive, createdBy: ids.mia },
    { id: surveys.byCarl, ownerId: null, createdBy: ids.carl },
  ].map((survey) => ({ ...survey, workspaceId: ids.workspace }));
  // No read check passed: the real one, against the graph.
  const recipients = await resolveSurveyNoticeRecipients(ids.organization, notice);
  return Object.fromEntries(notice.map((survey) => [survey.id, recipients.get(survey.id)?.name]));
};

const bobReads = async (surveyId: string) =>
  (await filterReadableSurveyIds({ type: "user", id: ids.bob }, [surveyId])).has(surveyId);

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Recipients Graph Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Recipients Graph", organizationId: organization.id },
  });
  ids.organization = organization.id;
  ids.workspace = workspace.id;

  const makeUser = async (
    name: string,
    role: "owner" | "manager" | "member",
    permission?: "read" | "readWrite"
  ) => {
    const user = await prisma.user.create({ data: { email: `${name}@recipients-graph.test`, name } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: user.id },
    });
    if (permission) {
      const team = await prisma.team.create({ data: { name, organizationId: organization.id } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
      await prisma.workspaceTeam.create({ data: { permission, teamId: team.id, workspaceId: workspace.id } });
    }
    return user.id;
  };
  ids.yan = await makeUser("yan", "owner");
  ids.ada = await makeUser("ada", "member", "readWrite");
  // Owns two surveys but has left the organisation since: no longer told.
  ids.olive = await makeUser("olive", "member");
  ids.bob = await makeUser("bob", "member", "read");
  // A member without access to the workspace: the graph denies him every survey in it.
  ids.carl = await makeUser("carl", "member");
  ids.mia = await makeUser("mia", "manager");

  const survey = async (name: string, ownerId: string | null, createdBy: string) =>
    (await prisma.survey.create({ data: { name, ownerId, createdBy, workspaceId: workspace.id } })).id;
  surveys.owned = await survey("Owned by Ada", ids.ada, ids.bob);
  surveys.byBob = await survey("Created by Bob", ids.olive, ids.bob);
  surveys.byMia = await survey("Created by Mia", ids.olive, ids.mia);
  surveys.byCarl = await survey("Created by Carl", null, ids.carl);

  await prisma.membership.delete({
    where: { userId_organizationId: { userId: ids.olive, organizationId: organization.id } },
  });

  await synchronizeAuthzedIntegrationFixture();
  await setProjectionScopeReady("survey", "integration");
  resetSurveyVisibilityReadinessMemo();
}, 120_000);

afterAll(async () => {
  await clearProjectionScopeReady("survey");
  resetSurveyVisibilityReadinessMemo();
});

test("before survey visibility is enforced, a creator without access to the workspace is still passed over", async () => {
  // The graph's survey check lets every survey through until the readiness marker is set; the
  // workspace check must rule Carl out on its own.
  await clearProjectionScopeReady("survey");
  resetSurveyVisibilityReadinessMemo();
  try {
    const carlReads = await filterReadableSurveyIds({ type: "user", id: ids.carl }, [surveys.byCarl]);
    expect(carlReads.has(surveys.byCarl)).toBe(true);
    expect(await recipientsByName()).toEqual({
      [surveys.owned]: "ada",
      [surveys.byBob]: "bob",
      [surveys.byMia]: "mia",
      [surveys.byCarl]: "yan",
    });
  } finally {
    await setProjectionScopeReady("survey", "integration");
    resetSurveyVisibilityReadinessMemo();
  }
});

test("a restriction stored but not yet projected passes over a member the graph still lets read the survey", async () => {
  // Workspace-visible and projected: the graph is the only check that rules anyone out (Carl).
  expect(await recipientsByName()).toEqual({
    [surveys.owned]: "ada",
    [surveys.byBob]: "bob",
    [surveys.byMia]: "mia",
    [surveys.byCarl]: "yan",
  });

  for (const surveyId of [surveys.owned, surveys.byBob, surveys.byMia]) {
    projection.failNext = true;
    const response = await changeV3SurveyVisibility({
      authentication: { expires: "2099-01-01", user: { id: ids.mia } } as never,
      body: { visibility: "restricted" },
      instance: "/api/v3/surveys",
      requestId: "req",
      surveyId,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ pending: "restricted", visibility: "restricted" });
  }
  // The graph hasn't caught up: it still lets Bob read the survey he created.
  expect(await bobReads(surveys.byBob)).toBe(true);

  const pending = {
    // The owner may read their own restricted survey.
    [surveys.owned]: "ada",
    // Bob may not, whatever the graph says: the organisation's owner is told instead.
    [surveys.byBob]: "yan",
    // A manager reads every survey: told as its creator, ahead of the owner fallback.
    [surveys.byMia]: "mia",
    [surveys.byCarl]: "yan",
  };
  expect(await recipientsByName()).toEqual(pending);

  // Once the outbox projects the restriction the graph agrees, and the recipients stay the same.
  const drained = await drainAuthzedOutbox();
  expect(drained).toMatchObject({ status: "drained", failed: 0, deadLettered: 0 });
  expect(await bobReads(surveys.byBob)).toBe(false);
  expect(await recipientsByName()).toEqual(pending);
});
