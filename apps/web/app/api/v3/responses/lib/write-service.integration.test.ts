import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";

/**
 * The scoped `connect`s, against a real Postgres.
 *
 * Two different things have to be true, and only one of them can be unit-tested. `write-service.test.ts`
 * proves *we hand Prisma the scoped connect* — delete the scope and those assertions go red. It cannot
 * prove *Prisma honours it*, because that behaviour lives in the query engine: an extended
 * `where`-unique carrying a non-unique filter beside the id is accepted by the types either way, so a
 * client that ignored the extra predicate would leave every unit test green while the write attached a
 * cross-tenant row. ENG-2861 asks for this file for exactly that reason.
 *
 * Written against Prisma directly rather than through `createScopedResponse`, deliberately. The
 * pre-flight checks refuse a foreign reference first and answer 422, so driving the whole function
 * never reaches the backstop — the thing under test here is only reachable once the checks are out of
 * the way, which is the state a future refactor could create. The connect shapes below are the ones
 * the service builds; keeping them identical is what makes this meaningful, and the unit tests are
 * what tie the service to them.
 */
beforeEach(async () => {
  await resetDb();
});

const makeTenant = async (label: string) => {
  const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: `${label} Survey`, workspaceId: workspace.id },
  });
  const otherSurvey = await prisma.survey.create({
    data: { name: `${label} Other Survey`, workspaceId: workspace.id },
  });
  const tag = await prisma.tag.create({ data: { name: `${label} tag`, workspaceId: workspace.id } });
  const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });
  const display = await prisma.display.create({ data: { surveyId: survey.id } });
  const displayOnOtherSurvey = await prisma.display.create({ data: { surveyId: otherSurvey.id } });

  return {
    workspaceId: workspace.id,
    surveyId: survey.id,
    tagId: tag.id,
    contactId: contact.id,
    displayId: display.id,
    displayOnOtherSurvey: displayOnOtherSurvey.id,
  };
};

const responseCount = async (surveyId: string): Promise<number> =>
  await prisma.response.count({ where: { surveyId } });

/**
 * The Prisma error code a refused write raises, or `null` if it was allowed.
 *
 * Asserted rather than `toBeInstanceOf`: the integration config aliases `@formbricks/database` to a
 * locally-built client, so the error class is not the one a direct import would give — and `P2025` is
 * the specific fact worth pinning anyway. A write that fails for some unrelated reason would report a
 * different code and fail this rather than passing as a refusal.
 */
const refusedWith = async (write: () => Promise<unknown>): Promise<string | null> => {
  try {
    await write();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};

describe("scoped connects, against real Postgres", () => {
  test("a tag from another workspace cannot be attached, and the write leaves nothing behind", async () => {
    const mine = await makeTenant("Mine");
    const theirs = await makeTenant("Theirs");

    expect(
      await refusedWith(() =>
        prisma.response.create({
          data: {
            finished: false,
            data: {},
            survey: { connect: { id: mine.surveyId } },
            // Their tag, my workspace scope — what a pre-flight bypass would send.
            tags: { create: [{ tag: { connect: { id: theirs.tagId, workspaceId: mine.workspaceId } } }] },
          },
          select: { id: true },
        })
      )
    ).toBe("P2025");

    // The rollback matters as much as the refusal: a response without its tag would still be a row
    // the caller never meant to create, and one no pre-flight would catch on the retry.
    expect(await responseCount(mine.surveyId)).toBe(0);
  });

  test("a contact from another workspace cannot be attached", async () => {
    const mine = await makeTenant("Mine");
    const theirs = await makeTenant("Theirs");

    expect(
      await refusedWith(() =>
        prisma.response.create({
          data: {
            finished: false,
            data: {},
            survey: { connect: { id: mine.surveyId } },
            contact: { connect: { id: theirs.contactId, workspaceId: mine.workspaceId } },
          },
          select: { id: true },
        })
      )
    ).toBe("P2025");

    expect(await responseCount(mine.surveyId)).toBe(0);
  });

  /**
   * Display carries no `workspaceId`, so it is scoped by survey. Workspace-only scoping would accept a
   * display belonging to a *different survey in the same workspace* — which is the case ENG-825 was
   * filed for, and the reason this assertion uses a second survey of the caller's own.
   */
  test("a display from another survey cannot be attached, even within the same workspace", async () => {
    const mine = await makeTenant("Mine");

    expect(
      await refusedWith(() =>
        prisma.response.create({
          data: {
            finished: false,
            data: {},
            survey: { connect: { id: mine.surveyId } },
            display: {
              connect: { id: mine.displayOnOtherSurvey, surveyId: mine.surveyId, response: null },
            },
          },
          select: { id: true },
        })
      )
    ).toBe("P2025");

    expect(await responseCount(mine.surveyId)).toBe(0);
  });

  /** `response: null` is what stops one display backing two responses — ENG-827 / ENG-1923. */
  test("a display already backing a response cannot be attached to a second one", async () => {
    const mine = await makeTenant("Mine");

    await prisma.response.create({
      data: {
        finished: false,
        data: {},
        survey: { connect: { id: mine.surveyId } },
        display: { connect: { id: mine.displayId, surveyId: mine.surveyId, response: null } },
      },
      select: { id: true },
    });

    expect(
      await refusedWith(() =>
        prisma.response.create({
          data: {
            finished: false,
            data: {},
            survey: { connect: { id: mine.surveyId } },
            display: { connect: { id: mine.displayId, surveyId: mine.surveyId, response: null } },
          },
          select: { id: true },
        })
      )
    ).toBe("P2025");

    // The first response survives; only the second was refused.
    expect(await responseCount(mine.surveyId)).toBe(1);
  });

  /**
   * The control. Without it every assertion above would still pass if the scoped connect refused
   * *everything* — a guard that rejects all writes is not a guard, it is an outage.
   */
  test("the caller's own references attach normally", async () => {
    const mine = await makeTenant("Mine");

    const created = await prisma.response.create({
      data: {
        finished: false,
        data: {},
        survey: { connect: { id: mine.surveyId } },
        contact: { connect: { id: mine.contactId, workspaceId: mine.workspaceId } },
        display: { connect: { id: mine.displayId, surveyId: mine.surveyId, response: null } },
        tags: { create: [{ tag: { connect: { id: mine.tagId, workspaceId: mine.workspaceId } } }] },
      },
      select: { id: true, contactId: true, displayId: true, tags: { select: { tagId: true } } },
    });

    expect(created.contactId).toBe(mine.contactId);
    expect(created.displayId).toBe(mine.displayId);
    expect(created.tags.map((row) => row.tagId)).toEqual([mine.tagId]);
    expect(await responseCount(mine.surveyId)).toBe(1);
  });
});
