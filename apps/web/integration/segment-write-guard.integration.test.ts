import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TBaseFilters } from "@formbricks/types/segment";
import { setV3SurveySegmentFilters } from "@/app/api/v3/surveys/targeting";
import { resetDb } from "@/integration/reset-db";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { SegmentSurveysChangedError } from "@/modules/ee/contacts/segments/lib/segment-errors";
import {
  deleteSegment,
  getExistingWorkspaceSurveyIds,
  getSurveyIdsTargetedThroughNesting,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";

/**
 * ENG-7269 against real Postgres: a segment write must answer for every survey the segment is connected
 * to, not only the ids the request names; and deleting a segment another segment's filter reads must be
 * refused instead of leaving a dangling reference. The unit suites mock Prisma, so only a real database
 * shows that the conditional UPDATE's relation filter matches the rows it claims to, and that the
 * visibility-scoped lookup admits exactly the surveys `survey.write` would.
 *
 * Fixture: `visible` is a workspace-visible app survey, `restricted` a restricted one owned by someone
 * else, `memberPrivate` a restricted one owned by the member. `target` is the shared segment under test.
 */

const attributeFilters = (value: string): TBaseFilters => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value,
    },
  },
];

const nestedSegmentFilters = (segmentId: string): TBaseFilters => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "segment", segmentId },
      qualifier: { operator: "userIsIn" },
      value: "",
    },
  },
];

let workspaceId: string;
let ownerId: string;
let memberId: string;
const ids = { visible: "", restricted: "", memberPrivate: "", target: "", referenced: "", control: "" };

const createSurvey = async (
  name: string,
  visibility: "restricted" | "workspace",
  owner: string
): Promise<string> =>
  (
    await prisma.survey.create({
      data: { name, type: "app", status: "inProgress", visibility, ownerId: owner, workspaceId },
      select: { id: true },
    })
  ).id;

beforeEach(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "ENG-7269 Org" } });
  workspaceId = (
    await prisma.workspace.create({ data: { name: "ENG-7269 Workspace", organizationId: organization.id } })
  ).id;
  ownerId = (await prisma.user.create({ data: { name: "Owner", email: "owner@eng7269.test" } })).id;
  memberId = (await prisma.user.create({ data: { name: "Member", email: "member@eng7269.test" } })).id;

  ids.visible = await createSurvey("Visible", "workspace", ownerId);
  ids.restricted = await createSurvey("Restricted", "restricted", ownerId);
  ids.memberPrivate = await createSurvey("Member's own", "restricted", memberId);

  ids.target = (
    await prisma.segment.create({
      data: {
        title: "Target",
        isPrivate: false,
        filters: attributeFilters("old@example.com"),
        workspaceId,
        surveys: { connect: { id: ids.visible } },
      },
      select: { id: true },
    })
  ).id;

  ids.referenced = (
    await prisma.segment.create({
      data: { title: "Referenced", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    })
  ).id;

  ids.control = (
    await prisma.segment.create({
      data: { title: "Control", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    })
  ).id;
});

describe("getExistingWorkspaceSurveyIds (ENG-7269)", () => {
  test("admits the workspace-visible and the caller's own surveys, never another owner's restricted one", async () => {
    const found = await getExistingWorkspaceSurveyIds(
      workspaceId,
      [ids.visible, ids.restricted, ids.memberPrivate],
      buildVisibleSurveyWhere({
        enforced: true,
        isOrganizationAdmin: false,
        kind: "user",
        userId: memberId,
      })
    );

    expect([...found].sort()).toEqual([ids.memberPrivate, ids.visible].sort());
  });
});

describe("updateSegment's connected-survey guard (ENG-7269)", () => {
  test("writes while every connected survey is in the authorized set", async () => {
    const next = attributeFilters("next@example.com");

    const updated = await updateSegment(ids.target, { filters: next }, { connectedSurveyIds: [ids.visible] });

    expect(updated.filters).toEqual(next);
  });

  test("refuses the write when a survey outside the authorized set is connected, leaving the filters", async () => {
    const before = await prisma.segment.findUniqueOrThrow({
      where: { id: ids.target },
      select: { filters: true },
    });
    // A survey connected after the caller's authorization check — the window the conditional UPDATE closes.
    await prisma.segment.update({
      where: { id: ids.target },
      data: { surveys: { connect: { id: ids.restricted } } },
    });

    await expect(
      updateSegment(
        ids.target,
        { filters: attributeFilters("next@example.com") },
        {
          connectedSurveyIds: [ids.visible],
        }
      )
    ).rejects.toBeInstanceOf(SegmentSurveysChangedError);

    expect(
      await prisma.segment.findUniqueOrThrow({ where: { id: ids.target }, select: { filters: true } })
    ).toEqual(before);
  });

  test("an empty authorized set only writes while the segment has no surveys", async () => {
    await expect(
      updateSegment(ids.target, { description: "blocked" }, { connectedSurveyIds: [] })
    ).rejects.toBeInstanceOf(SegmentSurveysChangedError);

    const unreferenced = await prisma.segment.create({
      data: { title: "Unreferenced", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    });
    await expect(
      updateSegment(unreferenced.id, { description: "allowed" }, { connectedSurveyIds: [] })
    ).resolves.toMatchObject({ description: "allowed" });
  });
});

describe("deleteSegment's reference guard (ENG-7269)", () => {
  test("refuses to delete a segment another segment's filters read", async () => {
    const referencing = await prisma.segment.create({
      data: {
        title: "Referencing",
        isPrivate: false,
        filters: nestedSegmentFilters(ids.referenced),
        workspaceId,
      },
      select: { id: true },
    });

    await expect(deleteSegment(ids.referenced)).rejects.toThrow(
      new OperationNotAllowedError("Cannot delete a segment that another segment's filters use")
    );

    expect(await prisma.segment.findUnique({ where: { id: ids.referenced } })).not.toBeNull();
    expect(await prisma.segment.findUnique({ where: { id: referencing.id } })).not.toBeNull();
  });

  test("refuses a reference nested inside a filter group", async () => {
    await prisma.segment.create({
      data: {
        title: "Nested reference",
        isPrivate: false,
        filters: [
          {
            id: createId(),
            connector: null,
            resource: nestedSegmentFilters(ids.referenced),
          },
        ],
        workspaceId,
      },
    });

    await expect(deleteSegment(ids.referenced)).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  test("deletes a segment no other segment reads", async () => {
    await prisma.segment.create({
      data: {
        title: "Reads another segment",
        isPrivate: false,
        filters: nestedSegmentFilters(ids.control),
        workspaceId,
      },
    });

    await expect(deleteSegment(ids.referenced)).resolves.toMatchObject({ id: ids.referenced });
    expect(await prisma.segment.findUnique({ where: { id: ids.referenced } })).toBeNull();
  });
});

describe("getSurveyIdsTargetedThroughNesting (ENG-7269)", () => {
  const createSegment = async (title: string, filters: TBaseFilters, surveyId?: string) =>
    (
      await prisma.segment.create({
        data: {
          title,
          isPrivate: false,
          filters,
          workspaceId,
          ...(surveyId && { surveys: { connect: { id: surveyId } } }),
        },
        select: { id: true },
      })
    ).id;

  test("finds the surveys of every segment that nests it, through a chain and a nested group", async () => {
    // restricted ← outer ─nests (in a group)→ middle ─nests→ referenced; memberPrivate ← middle.
    const middle = await createSegment("Middle", nestedSegmentFilters(ids.referenced), ids.memberPrivate);
    await createSegment(
      "Outer",
      [{ id: createId(), connector: null, resource: nestedSegmentFilters(middle) }],
      ids.restricted
    );

    expect((await getSurveyIdsTargetedThroughNesting(workspaceId, ids.referenced)).sort()).toEqual(
      [ids.memberPrivate, ids.restricted].sort()
    );
  });

  test("ends on a cycle among other segments and leaves out the segment's own surveys", async () => {
    const first = await createSegment("First", nestedSegmentFilters(ids.target), ids.restricted);
    await prisma.segment.update({
      where: { id: ids.target },
      data: { filters: nestedSegmentFilters(first) },
    });

    // target ⇄ first: only `first`'s survey targets `target` through nesting; `target`'s own is excluded.
    expect(await getSurveyIdsTargetedThroughNesting(workspaceId, ids.target)).toEqual([ids.restricted]);
  });

  test("ignores segments of another workspace and segments that nest a different one", async () => {
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: "Other",
        organizationId: (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }))
          .organizationId,
      },
      select: { id: true },
    });
    await prisma.segment.create({
      data: {
        title: "Foreign",
        isPrivate: false,
        filters: nestedSegmentFilters(ids.referenced),
        workspaceId: otherWorkspace.id,
      },
    });
    await createSegment("Nests control", nestedSegmentFilters(ids.control), ids.restricted);

    expect(await getSurveyIdsTargetedThroughNesting(workspaceId, ids.referenced)).toEqual([]);
  });
});

describe("setV3SurveySegmentFilters' own-private guard (ENG-7269)", () => {
  test("writes the survey's own private segment and refuses one another survey uses", async () => {
    const own = await prisma.segment.create({
      data: {
        title: ids.restricted,
        isPrivate: true,
        filters: [],
        workspaceId,
        surveys: { connect: { id: ids.restricted } },
      },
      select: { id: true },
    });
    const next = attributeFilters("v3@example.com");

    await setV3SurveySegmentFilters({ segmentId: own.id, ownerSurveyId: ids.restricted, filters: next });
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: own.id } })).filters).toEqual(next);

    // `target` is shared and used by `visible`: a v3 PATCH of `visible` must not write it.
    const before = await prisma.segment.findUniqueOrThrow({ where: { id: ids.target } });
    await expect(
      setV3SurveySegmentFilters({ segmentId: ids.target, ownerSurveyId: ids.visible, filters: next })
    ).rejects.toMatchObject({ invalidParams: [{ name: "targeting.filters" }] });
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ids.target } })).filters).toEqual(
      before.filters
    );
  });
});
