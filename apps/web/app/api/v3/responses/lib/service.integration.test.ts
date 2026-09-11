import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { deleteScopedResponse, deleteScopedResponses, getResponseWorkspaceId } from "./service";

/**
 * The tenancy guard, against a real Postgres.
 *
 * The unit tests assert the shape of the `where` clause handed to Prisma. That is not the same as
 * proving Prisma honours it: `delete` classically required a unique filter, and the extra
 * `survey: { workspaceId }` is a *non-unique* filter riding alongside the id. If the client were to
 * ignore it — or a future version were to stop supporting it — the scoping would silently become a
 * no-op, every unit test would still pass, and `DELETE /api/v3/responses/{id}` would delete any
 * response in the instance for any caller who could name it.
 *
 * That is the whole reason this file exists, and it needs a real database because the behaviour lives
 * in the query engine, not in our code.
 */
beforeEach(async () => {
  await resetDb();
});

const makeWorkspaceWithResponse = async (label: string) => {
  const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: `${label} Survey`, workspaceId: workspace.id },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, data: {}, finished: true },
  });

  return { workspaceId: workspace.id, surveyId: survey.id, responseId: response.id };
};

describe("deleteScopedResponse tenancy, against real Postgres", () => {
  test("refuses to delete a response belonging to another workspace", async () => {
    const mine = await makeWorkspaceWithResponse("Mine");
    const theirs = await makeWorkspaceWithResponse("Theirs");

    // The caller is authorized for their own workspace and names someone else's response — the exact
    // shape of a cross-tenant delete attempt.
    await expect(
      deleteScopedResponse(theirs.responseId, { workspaceId: mine.workspaceId })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    // The row is still there. Asserted separately from the throw: a guard that raises the right error
    // *after* deleting the row would satisfy the assertion above and still be a data-loss bug.
    const survivor = await prisma.response.findUnique({ where: { id: theirs.responseId } });
    expect(survivor).not.toBeNull();
  });

  test("deletes a response inside its own workspace", async () => {
    const mine = await makeWorkspaceWithResponse("Mine");

    await expect(
      deleteScopedResponse(mine.responseId, { workspaceId: mine.workspaceId })
    ).resolves.toMatchObject({ id: mine.responseId });

    const gone = await prisma.response.findUnique({ where: { id: mine.responseId } });
    expect(gone).toBeNull();
  });

  /**
   * The two failures a caller must not be able to tell apart. Both raise the same error class here, and
   * the operations layer renders both as the same 403 body — but the divergence would start at this
   * layer, so it is pinned at this layer too.
   */
  test("a foreign response and a nonexistent one fail identically", async () => {
    const mine = await makeWorkspaceWithResponse("Mine");
    const theirs = await makeWorkspaceWithResponse("Theirs");

    const foreign = await deleteScopedResponse(theirs.responseId, {
      workspaceId: mine.workspaceId,
    }).catch((error: unknown) => error);
    const missing = await deleteScopedResponse("clrsdoesnotexist00000000", {
      workspaceId: mine.workspaceId,
    }).catch((error: unknown) => error);

    expect(foreign).toBeInstanceOf(ResourceNotFoundError);
    expect(missing).toBeInstanceOf(ResourceNotFoundError);
    expect((foreign as Error).message).toBe((missing as Error).message);
  });

  test("resolves the owning workspace through the survey join", async () => {
    const mine = await makeWorkspaceWithResponse("Mine");

    await expect(getResponseWorkspaceId(mine.responseId)).resolves.toBe(mine.workspaceId);
    await expect(getResponseWorkspaceId("clrsdoesnotexist00000000")).resolves.toBeNull();
  });
});

/**
 * The quota effect, measured rather than mocked.
 *
 * A unit test that spies on `reduceQuotaLimits` can only observe *whether* it was called, never which
 * direction the capacity moved — which is exactly how an earlier version of this service shipped a
 * decrement that cancelled the slot the cascade had just freed. These assertions read `SurveyQuota` and
 * the live `ResponseQuotaLink` rows after the delete, so they fail if that decrement ever comes back.
 */
describe("deleteScopedResponse quota effects, against real Postgres", () => {
  const makeFullQuota = async () => {
    const organization = await prisma.organization.create({ data: { name: "Quota Org" } });
    const workspace = await prisma.workspace.create({
      data: { name: "Quota Workspace", organizationId: organization.id },
    });
    const survey = await prisma.survey.create({
      data: { name: "Quota Survey", workspaceId: workspace.id },
    });
    const quota = await prisma.surveyQuota.create({
      data: { surveyId: survey.id, name: "Cap", limit: 3, logic: {}, action: "endSurvey" },
    });

    // Fill it: three screened-in responses against a limit of 3.
    const responseIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await prisma.response.create({
        data: { surveyId: survey.id, data: {}, finished: true },
      });
      await prisma.responseQuotaLink.create({
        data: { responseId: response.id, quotaId: quota.id, status: "screenedIn" },
      });
      responseIds.push(response.id);
    }

    return { workspaceId: workspace.id, quotaId: quota.id, responseIds };
  };

  const readQuotaState = async (quotaId: string) => {
    const quota = await prisma.surveyQuota.findUniqueOrThrow({ where: { id: quotaId } });
    const screenedInCount = await prisma.responseQuotaLink.count({
      where: { quotaId, status: "screenedIn" },
    });
    // The repo's only fullness predicate, from `modules/ee/quotas/lib/utils.ts`.
    return { limit: quota.limit, screenedInCount, isFull: screenedInCount >= quota.limit };
  };

  test("deleting a screened-in response reopens the quota instead of shrinking its limit", async () => {
    const { workspaceId, quotaId, responseIds } = await makeFullQuota();

    expect(await readQuotaState(quotaId)).toStrictEqual({ limit: 3, screenedInCount: 3, isFull: true });

    await deleteScopedResponse(responseIds[0], { workspaceId });

    // The cascade drops the link, which is what frees the slot. `limit` is the customer's configured
    // target and must survive untouched — decrementing it here would leave `isFull` true and the
    // capacity permanently gone.
    expect(await readQuotaState(quotaId)).toStrictEqual({ limit: 3, screenedInCount: 2, isFull: false });
  });

  test("repeated deletes never ratchet the configured limit down", async () => {
    const { workspaceId, quotaId, responseIds } = await makeFullQuota();

    for (const responseId of responseIds) {
      await deleteScopedResponse(responseId, { workspaceId });
    }

    expect(await readQuotaState(quotaId)).toStrictEqual({ limit: 3, screenedInCount: 0, isFull: false });
  });
});

/**
 * Concurrency, measured against real Postgres.
 *
 * The scoped `delete` is the ownership check *and* the write, and a loser must be refused rather than
 * told it succeeded. That guarantee turned out to depend on the delete's `select`: on Prisma 7 a
 * `delete` whose select pulls a relation is compiled as read-then-delete and hands back the read
 * payload without checking the DELETE matched a row, so both racers resolve. Scalars only, and exactly
 * one raises `P2025`. A live two-request race against the dev server produced two 204s before the fix.
 */
describe("deleteScopedResponse under concurrency, against real Postgres", () => {
  test("two simultaneous deletes of the same response: exactly one succeeds", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const mine = await makeWorkspaceWithResponse(`Race${attempt}`);

      const outcomes = await Promise.allSettled([
        deleteScopedResponse(mine.responseId, { workspaceId: mine.workspaceId }),
        deleteScopedResponse(mine.responseId, { workspaceId: mine.workspaceId }),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const refused = outcomes.filter(
        (o) => o.status === "rejected" && o.reason instanceof ResourceNotFoundError
      );

      expect({ attempt, fulfilled: fulfilled.length, refused: refused.length }).toStrictEqual({
        attempt,
        fulfilled: 1,
        refused: 1,
      });
      expect(await prisma.response.count({ where: { id: mine.responseId } })).toBe(0);
    }
  });
});

/**
 * Batch delete, against real Postgres.
 *
 * The contract's two load-bearing promises are both properties of the SQL, not of our code: that an
 * out-of-scope id is filtered rather than refused, and that `deleted` reports what the database
 * actually removed. Neither can be observed against a mock.
 */
describe("deleteScopedResponses, against real Postgres", () => {
  const makeWorkspace = async (label: string) => {
    const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
    const workspace = await prisma.workspace.create({
      data: { name: `${label} Workspace`, organizationId: organization.id },
    });
    const survey = await prisma.survey.create({
      data: { name: `${label} Survey`, workspaceId: workspace.id },
    });
    return { workspaceId: workspace.id, surveyId: survey.id };
  };

  const addResponses = async (surveyId: string, count: number) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const response = await prisma.response.create({ data: { surveyId, data: {}, finished: true } });
      ids.push(response.id);
    }
    return ids;
  };

  test("deletes the ids in scope and reports how many that was", async () => {
    const mine = await makeWorkspace("Mine");
    const ids = await addResponses(mine.surveyId, 3);

    await expect(deleteScopedResponses(ids, { workspaceId: mine.workspaceId })).resolves.toMatchObject({
      deleted: 3,
    });
    expect(await prisma.response.count({ where: { id: { in: ids } } })).toBe(0);
  });

  /**
   * The whole reason the operation scope-filters instead of rejecting. A batch mixing a foreign id in
   * must delete the caller's own and leave the other alone — not refuse, which would leak that the id
   * exists, and not delete it, which is the cross-tenant bug.
   */
  test("ignores another workspace's ids instead of refusing or deleting them", async () => {
    const mine = await makeWorkspace("Mine");
    const theirs = await makeWorkspace("Theirs");
    const myIds = await addResponses(mine.surveyId, 2);
    const theirIds = await addResponses(theirs.surveyId, 2);

    const result = await deleteScopedResponses([...myIds, ...theirIds], {
      workspaceId: mine.workspaceId,
    });

    expect(result.deleted).toBe(2);
    expect(await prisma.response.count({ where: { id: { in: myIds } } })).toBe(0);
    // Asserted separately from the count: a guard that returns the right number while still deleting
    // the foreign rows would satisfy the assertion above and be a cross-tenant data-loss bug.
    expect(await prisma.response.count({ where: { id: { in: theirIds } } })).toBe(2);
  });

  test("is idempotent: replaying the same batch deletes nothing more and does not throw", async () => {
    const mine = await makeWorkspace("Mine");
    const ids = await addResponses(mine.surveyId, 2);

    expect((await deleteScopedResponses(ids, { workspaceId: mine.workspaceId })).deleted).toBe(2);
    expect((await deleteScopedResponses(ids, { workspaceId: mine.workspaceId })).deleted).toBe(0);
  });

  test("answers zero for a batch of ids that are all out of scope", async () => {
    const mine = await makeWorkspace("Mine");
    const theirs = await makeWorkspace("Theirs");
    const theirIds = await addResponses(theirs.surveyId, 2);

    const result = await deleteScopedResponses(theirIds, { workspaceId: mine.workspaceId });

    expect(result).toStrictEqual({ deleted: 0, deletedIds: [] });
    expect(await prisma.response.count({ where: { id: { in: theirIds } } })).toBe(2);
  });

  /**
   * What this pins is that displays are removed rather than orphaned — the batch reads `displayId`
   * off rows that are about to vanish, so missing that step leaves a dangling display behind and
   * nothing else notices.
   *
   * It deliberately does not assert the delete *order*. `Response_displayId_fkey` is
   * `ON DELETE SET NULL`, so displays-first also succeeds; the order is a cost choice, not a
   * correctness one, and a test claiming otherwise would be asserting a constraint the schema does
   * not impose.
   */
  test("removes the linked displays rather than orphaning them", async () => {
    const mine = await makeWorkspace("Mine");
    const display = await prisma.display.create({ data: { surveyId: mine.surveyId } });
    const withDisplay = await prisma.response.create({
      data: { surveyId: mine.surveyId, data: {}, finished: true, displayId: display.id },
    });
    const [plain] = await addResponses(mine.surveyId, 1);

    const result = await deleteScopedResponses([withDisplay.id, plain], {
      workspaceId: mine.workspaceId,
    });

    expect(result.deleted).toBe(2);
    expect(await prisma.display.count({ where: { id: display.id } })).toBe(0);
  });

  test("spans several surveys in the same workspace", async () => {
    const mine = await makeWorkspace("Mine");
    const second = await prisma.survey.create({
      data: { name: "Mine Survey 2", workspaceId: mine.workspaceId },
    });
    const ids = [...(await addResponses(mine.surveyId, 2)), ...(await addResponses(second.id, 2))];

    expect((await deleteScopedResponses(ids, { workspaceId: mine.workspaceId })).deleted).toBe(4);
  });

  /**
   * Same decision as the single delete: the cascade on `ResponseQuotaLink` frees the slot, and
   * decrementing `SurveyQuota.limit` on top of it would cancel that and shrink a customer-configured
   * setting. A batch makes the ratchet worse — 100 deletes would be 100 decrements.
   */
  test("never shrinks a quota's configured limit", async () => {
    const mine = await makeWorkspace("Mine");
    const quota = await prisma.surveyQuota.create({
      data: { surveyId: mine.surveyId, name: "Cap", limit: 5, logic: {}, action: "endSurvey" },
    });
    const ids = await addResponses(mine.surveyId, 3);
    for (const responseId of ids) {
      await prisma.responseQuotaLink.create({
        data: { responseId, quotaId: quota.id, status: "screenedIn" },
      });
    }

    await deleteScopedResponses(ids, { workspaceId: mine.workspaceId });

    expect(await prisma.surveyQuota.findUniqueOrThrow({ where: { id: quota.id } })).toMatchObject({
      limit: 5,
    });
    expect(await prisma.responseQuotaLink.count({ where: { quotaId: quota.id } })).toBe(0);
  });
});
