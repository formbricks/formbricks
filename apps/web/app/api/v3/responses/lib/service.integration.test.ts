import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { deleteScopedResponse, getResponseWorkspaceId } from "./service";

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
