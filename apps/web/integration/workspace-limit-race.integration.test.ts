import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

/**
 * The organization workspace limit against real Postgres (ENG-3921).
 *
 * The limit used to be a count read in the server action and compared before `createWorkspace` ran,
 * so a burst of concurrent creates all read the same count, all passed, and the organization ended up
 * as far past its cap as the burst was wide. A mocked unit test cannot fail on that: each request
 * decides correctly on what it reads, and the defect is that they all read before anyone writes. Only
 * a real database with the creates genuinely in flight at once can tell the locked check from the old
 * one.
 */

const LIMIT = 3;
const BURST = 20;

const seedOrganization = async (name: string, existingWorkspaces: number): Promise<string> => {
  const organization = await prisma.organization.create({ data: { name } });
  for (let index = 0; index < existingWorkspaces; index++) {
    await prisma.workspace.create({ data: { name: `existing-${index}`, organizationId: organization.id } });
  }
  return organization.id;
};

/** Fires `BURST` creates with distinct names (one name per workspace is unique) all at once. */
const burst = (organizationId: string) =>
  Promise.allSettled(
    Array.from({ length: BURST }, (_, index) =>
      createWorkspace(organizationId, { name: `burst-${index}` }, { workspaceLimit: LIMIT })
    )
  );

const countWorkspaces = (organizationId: string) => prisma.workspace.count({ where: { organizationId } });

const rejectionsOf = (outcomes: PromiseSettledResult<unknown>[]) =>
  outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));

/** Every loser is the limit, not a deadlock, a lock timeout or a unique violation. */
const expectLimitRejections = (outcomes: PromiseSettledResult<unknown>[], expected: number) => {
  const rejections = rejectionsOf(outcomes);
  expect(rejections).toHaveLength(expected);
  for (const reason of rejections) {
    expect(reason).toBeInstanceOf(OperationNotAllowedError);
  }
};

beforeEach(async () => {
  await resetDb();
});

describe("createWorkspace workspace limit (real Postgres)", () => {
  test("a concurrent burst below the limit fills it exactly and no further", async () => {
    const organizationId = await seedOrganization("Below the limit", 1);

    const outcomes = await burst(organizationId);

    expect(await countWorkspaces(organizationId)).toBe(LIMIT);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(LIMIT - 1);
    expectLimitRejections(outcomes, BURST - (LIMIT - 1));
  });

  test("a concurrent burst at the limit creates nothing", async () => {
    const organizationId = await seedOrganization("At the limit", LIMIT);

    const outcomes = await burst(organizationId);

    expect(await countWorkspaces(organizationId)).toBe(LIMIT);
    expectLimitRejections(outcomes, BURST);
  });

  test("concurrent bursts on two organizations each fill their own limit", async () => {
    const [first, second] = await Promise.all([seedOrganization("First", 0), seedOrganization("Second", 2)]);

    const [firstOutcomes, secondOutcomes] = await Promise.all([burst(first), burst(second)]);

    expect(await countWorkspaces(first)).toBe(LIMIT);
    expect(await countWorkspaces(second)).toBe(LIMIT);
    expectLimitRejections(firstOutcomes, BURST - LIMIT);
    expectLimitRejections(secondOutcomes, BURST - (LIMIT - 2));
  });
});
