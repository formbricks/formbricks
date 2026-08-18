import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * Covers the tags settings table end to end after its move onto `/api/v3/tags` + TanStack Query: the list
 * now arrives from the API rather than server props, and rename/merge/delete invalidate the query instead
 * of calling `router.refresh()`. Each assertion below is a thing that silently breaks if the query key,
 * the invalidation, or the route's authorization scope is wrong.
 */

// Unique per run *and* per worker: two workers starting in the same millisecond would otherwise collide on
// the user email, and `Tag` is unique on `[workspaceId, name]`.
const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

test.describe("Workspace tags settings @slow", () => {
  test("lists tags from the API, renames, merges and deletes without a page reload", async ({
    page,
    users,
  }) => {
    const run = stamp();
    const user = await users.create({
      email: `tags-${run}@example.com`,
      name: `tags-${run}`,
      workspaceName: `Tags Workspace ${run}`,
    });
    const { workspaceId } = user;
    if (!workspaceId) {
      throw new Error("Workspace not seeded for the test user");
    }

    const keep = await prisma.tag.create({ data: { workspaceId, name: `Keep ${run}` } });
    const mergeAway = await prisma.tag.create({ data: { workspaceId, name: `Merge ${run}` } });
    const doomed = await prisma.tag.create({ data: { workspaceId, name: `Doomed ${run}` } });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/workspaces/${workspaceId}/settings/workspace/tags`, {
      waitUntil: "domcontentloaded",
    });

    // Rows are addressed by the id the API returned, and names are read with `toHaveValue`, which reads
    // the live value. An `input[value="…"]` selector would match the *attribute* instead — `fill()` never
    // updates that, so such a locator passes before a rename and fails after one for the wrong reason.
    const rowFor = (tagId: string) => page.getByTestId(`tag-row-${tagId}`);
    const nameFieldFor = (tagId: string) => rowFor(tagId).getByRole("textbox", { name: "Tag" });

    // Seeing all three proves GET /api/v3/tags resolved and its response populated the table.
    for (const tag of [keep, mergeAway, doomed]) {
      await expect(nameFieldFor(tag.id)).toHaveValue(tag.name, { timeout: 15000 });
    }

    const renames: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && request.url().includes("/api/v3/tags/")) {
        renames.push(request.url());
      }
    });

    // Blurring without editing must not write. This is counted rather than timed: the no-op blur is
    // followed immediately by one real rename of the same row, so a stray request makes the count 2.
    await nameFieldFor(keep.id).click();
    await nameFieldFor(keep.id).blur();

    const renamed = `Renamed ${run}`;
    await nameFieldFor(keep.id).fill(renamed);
    await nameFieldFor(keep.id).blur();
    await expect(page.locator(".formbricks__toast__success")).toBeVisible({ timeout: 15000 });
    await expect(nameFieldFor(keep.id)).toHaveValue(renamed);
    expect(await prisma.tag.findUnique({ where: { id: keep.id } })).toMatchObject({ name: renamed });
    expect(renames).toHaveLength(1);

    // Renaming onto a name already in use is rejected, and must leave the stored name alone.
    await nameFieldFor(doomed.id).fill(renamed);
    await nameFieldFor(doomed.id).blur();
    await expect(page.locator(".formbricks__toast__error")).toBeVisible({ timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: doomed.id } })).toMatchObject({
      name: doomed.name,
    });

    // Merge: the source row leaves the table with no reload, which is what proves the invalidation ran.
    await rowFor(mergeAway.id).getByRole("button", { name: "Merge" }).click();
    await page.getByRole("option", { name: renamed }).click();
    await expect(rowFor(mergeAway.id)).toHaveCount(0, { timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: mergeAway.id } })).toBeNull();

    // Delete: same again, through the confirmation dialog. Scoped to the dialog because the row's own
    // trigger carries the same accessible name.
    await rowFor(doomed.id).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(rowFor(doomed.id)).toHaveCount(0, { timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: doomed.id } })).toBeNull();

    // The surviving tag is untouched by either removal.
    await expect(nameFieldFor(keep.id)).toHaveValue(renamed);
  });

  test("rejects a tag mutation from a workspace the caller cannot write to", async ({ page, users }) => {
    const run = stamp();
    const owner = await users.create({
      email: `tags-owner-${run}@example.com`,
      name: `tags-owner-${run}`,
      workspaceName: `Owner Workspace ${run}`,
    });
    const outsider = await users.create({
      email: `tags-outsider-${run}@example.com`,
      name: `tags-outsider-${run}`,
      workspaceName: `Outsider Workspace ${run}`,
    });

    const ownerWorkspaceId = owner.workspaceId;
    if (!ownerWorkspaceId) {
      throw new Error("Workspace not seeded for the owner");
    }
    const foreignTag = await prisma.tag.create({
      data: { workspaceId: ownerWorkspaceId, name: `Foreign ${run}` },
    });

    // The route resolves the workspace from the tag itself, so holding a valid tag id is not enough. A 404
    // here instead of a 403 would leak that the tag exists to anyone who can guess an id.
    await page.context().clearCookies();
    await outsider.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const response = await page.request.patch(`/api/v3/tags/${foreignTag.id}`, {
      data: { name: `Hijacked ${run}` },
    });
    expect(response.status()).toBe(403);
    expect(await prisma.tag.findUnique({ where: { id: foreignTag.id } })).toMatchObject({
      name: foreignTag.name,
    });
  });
});
