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
    ).resolves.toBeUndefined();

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
