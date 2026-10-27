import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { resolveSurveyNoticeRecipients } from "./recipients";

/**
 * Notice recipients against real survey rows and the real readiness marker (ENG-3612): a visibility
 * change still pending counts as restricted, as on every read path, even while the graph still lets
 * the member read the survey.
 *
 * The read check stands in for SpiceDB before the change is projected: it lets everyone read every
 * survey, which is exactly the window this guards. The same composition with the real read check against
 * SpiceDB is `recipients-graph.integration.test.ts`.
 */
const graphNotYetProjected = async (_actor: unknown, surveyIds: ReadonlyArray<string>) => new Set(surveyIds);

const setMarker = async (ready: boolean) => {
  await (ready ? setProjectionScopeReady("survey", "integration") : clearProjectionScopeReady("survey"));
  resetSurveyVisibilityReadinessMemo();
};

describe("resolveSurveyNoticeRecipients and survey visibility (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  const people: Record<"ada" | "bob" | "mia" | "yan", string> = { ada: "", bob: "", mia: "", yan: "" };

  const person = async (name: keyof typeof people, role: "owner" | "manager" | "member") => {
    const user = await prisma.user.create({ data: { name, email: `${name}@example.com` } });
    await prisma.membership.create({ data: { userId: user.id, organizationId, role, accepted: true } });
    people[name] = user.id;
  };

  /** A survey whose creation the graph has acknowledged: settled, nothing pending. */
  const settledSurvey = async (name: string, ownerId: string | null, createdBy: string) => {
    const { id } = await prisma.survey.create({ data: { name, workspaceId, ownerId, createdBy } });
    await prisma.$executeRaw`UPDATE "Survey" SET "visibilityProjectedVersion" = 0 WHERE "id" = ${id}`;
    return { id, workspaceId, ownerId, createdBy };
  };

  /** A restriction stored through the visibility endpoint that the graph hasn't acknowledged yet. */
  const restrictPending = async (surveyId: string) => {
    await prisma.$executeRaw`UPDATE "Survey" SET "visibility" = 'restricted', "visibilityVersion" = 1 WHERE "id" = ${surveyId}`;
    const row = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: { visibilityPending: true },
    });
    expect(row.visibilityPending).toBe(true);
  };

  const emailOf = async (
    surveys: { id: string; workspaceId: string; ownerId: string | null; createdBy: string }[]
  ) => {
    const recipients = await resolveSurveyNoticeRecipients(organizationId, surveys, graphNotYetProjected);
    return Object.fromEntries(surveys.map((survey) => [survey.id, recipients.get(survey.id)?.name]));
  };

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    await person("ada", "member");
    await person("bob", "member");
    await person("mia", "manager");
    await person("yan", "owner");
    await setMarker(true);
  });

  afterAll(async () => {
    await setMarker(false);
  });

  test("a pending restriction passes over a plain-member creator; the owner and admins still qualify", async () => {
    const owned = await settledSurvey("Owned", people.ada, people.bob);
    const ownerless = await settledSurvey("Ownerless", null, people.bob);
    const byManager = await settledSurvey("By manager", null, people.mia);
    for (const survey of [owned, ownerless, byManager]) await restrictPending(survey.id);

    expect(await emailOf([owned, ownerless, byManager])).toEqual({
      // The owner may read their own restricted survey.
      [owned.id]: "ada",
      // Bob may not, though the graph still lets him: the organisation's owner is told instead.
      [ownerless.id]: "yan",
      // A manager may read every survey: told as its creator, ahead of the owner fallback.
      [byManager.id]: "mia",
    });
  });

  test("a workspace-visible survey still goes to its creator, including one in its initial projection", async () => {
    const settled = await settledSurvey("Settled", null, people.bob);
    const { id: fresh } = await prisma.survey.create({
      data: { name: "Just created", workspaceId, createdBy: people.bob },
    });
    const initial = await prisma.survey.findUniqueOrThrow({
      where: { id: fresh },
      select: { visibilityPending: true, visibilityProjectedVersion: true },
    });
    // Awaiting its first projection: the column says pending, but it is not a pending change.
    expect(initial).toEqual({ visibilityPending: true, visibilityProjectedVersion: -1 });

    expect(
      await emailOf([settled, { id: fresh, workspaceId, ownerId: null, createdBy: people.bob }])
    ).toEqual({
      [settled.id]: "bob",
      [fresh]: "bob",
    });
  });

  test("before visibility is enforced, a stored restriction still passes over a plain-member creator", async () => {
    // Stored visibility facts hold before projection readiness, as on the outbound paths: fail closed.
    const ownerless = await settledSurvey("Ownerless", null, people.bob);
    await restrictPending(ownerless.id);
    await setMarker(false);

    expect(await emailOf([ownerless])).toEqual({ [ownerless.id]: "yan" });
  });
});
