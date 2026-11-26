import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PATCH } from "@/app/api/v3/tags/[tagId]/route";
import { callRoute, seedOwner, signIn } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";

/**
 * `PATCH /api/v3/tags/{tagId}` resolves the workspace from the tag, so holding a valid tag id from another
 * tenant is not enough to rename it. Run against the real SpiceDB, where `operations.test.ts` mocks the
 * access check. Moved from `playwright/settings-tags.spec.ts` (ENG-7518).
 */

vi.mock("next/headers", async () => (await import("@/integration/next-headers")).nextHeadersMock);

beforeEach(async () => {
  await resetDb();
});

test("a signed-in user cannot rename another workspace's tag, and gets 403 rather than 404", async () => {
  const owner = await seedOwner("owner");
  const outsider = await seedOwner("outsider");
  const foreignTag = await prisma.tag.create({ data: { workspaceId: owner.workspaceId, name: "Foreign" } });

  const response = await callRoute(PATCH, {
    method: "PATCH",
    path: `/api/v3/tags/${foreignTag.id}`,
    params: { tagId: foreignTag.id },
    cookie: await signIn(outsider),
    body: { name: "Hijacked" },
  });

  // A 404 instead would tell anyone who guesses an id that the tag exists.
  expect(response.status).toBe(403);
  expect(await prisma.tag.findUnique({ where: { id: foreignTag.id } })).toMatchObject({ name: "Foreign" });
});

test("the tag's own owner can rename it through the same request", async () => {
  const owner = await seedOwner("owner");
  const tag = await prisma.tag.create({ data: { workspaceId: owner.workspaceId, name: "Mine" } });

  const response = await callRoute(PATCH, {
    method: "PATCH",
    path: `/api/v3/tags/${tag.id}`,
    params: { tagId: tag.id },
    cookie: await signIn(owner),
    body: { name: "Renamed" },
  });

  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(await prisma.tag.findUnique({ where: { id: tag.id } })).toMatchObject({ name: "Renamed" });
});
