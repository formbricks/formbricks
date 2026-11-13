import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TBaseFilters } from "@formbricks/types/segment";
import { resetDb } from "@/integration/reset-db";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { buildContactInteractionData } from "@/modules/ee/contacts/api/v1/client/[workspaceId]/user/lib/segments";
import { generatePersonalLinks } from "@/modules/ee/contacts/lib/contacts";
import { SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { tryEvaluateSurveyInteractionSegmentInMemory } from "@/modules/ee/contacts/segments/lib/filter/survey-interaction";
import { segmentFiltersReadHiddenSurvey } from "@/modules/ee/contacts/segments/lib/helper";

/**
 * ENG-6870 against real Postgres: survey-interaction segments must not tell a caller who interacted with
 * a survey hidden from them. The unit suites mock Prisma, so only a real database shows that the `any`
 * scope's `survey` relation filter and the hidden-survey lookups select the rows they claim to, on the
 * visibility columns the migrations and their triggers actually maintain.
 *
 * The fixture is the ticket's reproduction: surveys D and V are workspace-visible, R is restricted and
 * owned by the organization owner, P is mid-change (pending). Contact c1 completed R only, c2 completed V
 * only, c3 has nothing, c4 completed P only.
 */

let workspaceId: string;
let ownerId: string;
let memberId: string;
const surveys: Record<"D" | "V" | "R" | "P", string> = { D: "", V: "", R: "", P: "" };
const contacts: Record<"c1" | "c2" | "c3" | "c4", string> = { c1: "", c2: "", c3: "", c4: "" };

const member = (): TSurveyActorContext => ({
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: memberId,
});
const owner = (): TSurveyActorContext => ({
  enforced: true,
  isOrganizationAdmin: true,
  kind: "user",
  userId: ownerId,
});
const apiKey: TSurveyActorContext = { enforced: true, kind: "apiKey" };

const within = { amount: 30, unit: "days" } as const;
let seq = 0;
const interaction = (
  operator: string,
  surveyScope: "any" | "specific",
  surveyIds: string[] = [],
  connector: "and" | "or" | null = null
) => {
  seq += 1;
  return {
    id: `clfilter${String(seq).padStart(17, "0")}`,
    connector,
    resource: {
      id: `clresrc${String(seq).padStart(18, "0")}`,
      root: { type: "surveyInteraction" },
      qualifier: { operator },
      value: { surveyScope, surveyIds, within },
    },
  };
};
const tree = (...filters: unknown[]) => filters as TBaseFilters;

const seed = async (): Promise<void> => {
  const organization = await prisma.organization.create({ data: { name: "ENG-6870 Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-6870 Workspace", organizationId: organization.id },
  });
  workspaceId = workspace.id;
  ownerId = (await prisma.user.create({ data: { name: "Owner", email: "owner@eng6870.test" } })).id;
  memberId = (await prisma.user.create({ data: { name: "Member", email: "member@eng6870.test" } })).id;

  const createSurvey = async (name: string, extra: Record<string, unknown> = {}) =>
    (
      await prisma.survey.create({
        data: { name, type: "link", status: "inProgress", workspaceId, ...extra },
        select: { id: true },
      })
    ).id;
  surveys.D = await createSurvey("D");
  surveys.V = await createSurvey("V");
  surveys.R = await createSurvey("R", { visibility: "restricted", ownerId });
  surveys.P = await createSurvey("P");
  // A visibility change the graph has not acknowledged yet: effectively restricted (fail closed).
  await prisma.survey.update({
    where: { id: surveys.P },
    data: { visibilityVersion: 2, visibilityProjectedVersion: 1 },
  });

  for (const name of Object.keys(contacts) as (keyof typeof contacts)[]) {
    contacts[name] = (await prisma.contact.create({ data: { workspaceId } })).id;
  }
  const complete = async (contact: keyof typeof contacts, survey: keyof typeof surveys) => {
    await prisma.display.create({ data: { surveyId: surveys[survey], contactId: contacts[contact] } });
    await prisma.response.create({
      data: { surveyId: surveys[survey], contactId: contacts[contact], finished: true, data: {} },
    });
  };
  await complete("c1", "R");
  await complete("c2", "V");
  await complete("c4", "P");
};

const segmentMembers = async (filters: TBaseFilters): Promise<string[]> => {
  const query = await segmentFilterToPrismaQuery("clsegment0000000000000001", filters, workspaceId);
  if (!query.ok) throw new Error("segmentFilterToPrismaQuery failed");
  const rows = await prisma.contact.findMany({ where: query.data.whereClause, select: { id: true } });
  return rows.map((row) => row.id).sort();
};

/** The contact-sync hot path: the rows `update-user.ts` loads, marked and evaluated in memory. */
const inMemoryMembers = async (filters: TBaseFilters): Promise<string[]> => {
  const rows = await prisma.contact.findMany({
    where: { workspaceId },
    select: {
      id: true,
      displays: { select: { surveyId: true, createdAt: true } },
      responses: { select: { surveyId: true, createdAt: true, finished: true } },
    },
  });
  const now = new Date();
  const members: string[] = [];
  for (const row of rows) {
    const data = await buildContactInteractionData(workspaceId, row, true);
    if (tryEvaluateSurveyInteractionSegmentInMemory(filters, data, now)) members.push(row.id);
  }
  return members.sort();
};

describe("segment survey visibility against real Postgres (ENG-6870)", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  test("`any` scope only counts workspace-visible surveys, in the database and in memory", async () => {
    const completedAny = tree(interaction("haveCompleted", "any"));
    const notSeenAny = tree(interaction("haveNotSeen", "any"));

    // c1 (restricted only) and c4 (pending only) count as having done nothing.
    expect(await segmentMembers(completedAny)).toEqual([contacts.c2].sort());
    expect(await inMemoryMembers(completedAny)).toEqual([contacts.c2].sort());
    // The fatigue rule still works, and treats them the same way.
    const quiet = [contacts.c1, contacts.c3, contacts.c4].sort();
    expect(await segmentMembers(notSeenAny)).toEqual(quiet);
    expect(await inMemoryMembers(notSeenAny)).toEqual(quiet);
  });

  test("the member-built `any` tree from the report no longer isolates the restricted survey's respondent", async () => {
    // Completed some survey, but none of the ones the member can see. On main this returned exactly c1.
    const filters = tree(
      interaction("haveCompleted", "any"),
      interaction("haveNotCompleted", "specific", [surveys.V, surveys.D], "and")
    );

    expect(await segmentMembers(filters)).toEqual([]);
    expect(await inMemoryMembers(filters)).toEqual([]);
  });

  test("a specific filter still reads the survey it names, so naming a hidden one is what gets refused", async () => {
    const filters = tree(interaction("haveCompleted", "specific", [surveys.R]));

    expect(await segmentMembers(filters)).toEqual([contacts.c1]);
    expect(await segmentFiltersReadHiddenSurvey(filters, workspaceId, member())).toBe(true);
    expect(await segmentFiltersReadHiddenSurvey(filters, workspaceId, apiKey)).toBe(true);
    expect(await segmentFiltersReadHiddenSurvey(filters, workspaceId, owner())).toBe(false);
    // R's owner sees R even without an administrator role.
    expect(await segmentFiltersReadHiddenSurvey(filters, workspaceId, { ...member(), userId: ownerId })).toBe(
      false
    );
  });

  test("a pending survey is hidden from a member, a workspace-visible one is not", async () => {
    expect(
      await segmentFiltersReadHiddenSurvey(
        tree(interaction("haveSeen", "specific", [surveys.P])),
        workspaceId,
        member()
      )
    ).toBe(true);
    expect(
      await segmentFiltersReadHiddenSurvey(
        tree(interaction("haveSeen", "specific", [surveys.V, surveys.D])),
        workspaceId,
        member()
      )
    ).toBe(false);
  });

  test("a nested segment that names the restricted survey is followed", async () => {
    const inner = await prisma.segment.create({
      data: {
        title: "inner",
        workspaceId,
        filters: tree(interaction("haveCompleted", "specific", [surveys.R])) as object[],
      },
    });
    const outer = tree({
      id: "clfilterouter00000000001",
      connector: null,
      resource: {
        id: "clresrcouter000000000001",
        root: { type: "segment", segmentId: inner.id },
        qualifier: { operator: "userIsIn" },
        value: inner.id,
      },
    });

    expect(await segmentFiltersReadHiddenSurvey(outer, workspaceId, member())).toBe(true);
  });

  test("personal links: a member is refused a segment naming the restricted survey, an owner is not", async () => {
    const segment = await prisma.segment.create({
      data: {
        title: "completed R",
        workspaceId,
        isPrivate: false,
        filters: tree(interaction("haveCompleted", "specific", [surveys.R])) as object[],
      },
    });

    await expect(generatePersonalLinks(surveys.D, segment.id, member())).rejects.toThrow(
      SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE
    );
    const links = await generatePersonalLinks(surveys.D, segment.id, owner());
    expect(links?.map((link) => link?.contactId)).toEqual([contacts.c1]);
  });
});
