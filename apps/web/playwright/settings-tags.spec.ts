import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * Covers the tags settings table end to end after its move onto `/api/v3/tags` + TanStack Query: the list
 * now arrives from the API rather than server props, and rename/merge/delete invalidate the query instead
 * of calling `router.refresh()`. Each assertion below is a thing that silently breaks if the query key,
 * the invalidation, or the route's authorization scope is wrong.
 */
test.describe("Workspace tags settings @slow", () => {
  test("lists tags from the API, renames, merges and deletes without a page reload", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const user = await users.create({
      email: `tags-${timestamp}@example.com`,
      name: `tags-${timestamp}`,
      workspaceName: "Tags Workspace",
    });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const workspaceId =
      /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine workspace id from surveys URL");
      })();

    const keep = await prisma.tag.create({ data: { workspaceId, name: `Keep ${timestamp}` } });
    const mergeAway = await prisma.tag.create({ data: { workspaceId, name: `Merge ${timestamp}` } });
    const doomed = await prisma.tag.create({ data: { workspaceId, name: `Doomed ${timestamp}` } });

    await page.goto(`/workspaces/${workspaceId}/settings/workspace/tags`);

    // The list comes from the API now, so seeing all three proves GET /api/v3/tags resolved and the
    // query populated the table.
    for (const tag of [keep, mergeAway, doomed]) {
      await expect(page.getByRole("textbox", { name: "Tag" })).not.toHaveCount(0);
      await expect(page.locator(`input[value="${tag.name}"]`)).toBeVisible({ timeout: 15000 });
    }

    // Rename: blur commits it. The input is disabled while the request is in flight, which is what stops
    // a second blur racing the first.
    const renamed = `Renamed ${timestamp}`;
    const keepInput = page.locator(`input[value="${keep.name}"]`);
    await keepInput.fill(renamed);
    await keepInput.blur();
    await expect(page.locator(".formbricks__toast__success")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`input[value="${renamed}"]`)).toBeVisible();
    expect(await prisma.tag.findUnique({ where: { id: keep.id } })).toMatchObject({ name: renamed });

    // Renaming onto an existing name must be rejected inline, not silently applied.
    const doomedInput = page.locator(`input[value="${doomed.name}"]`);
    await doomedInput.fill(renamed);
    await doomedInput.blur();
    await expect(page.locator(".formbricks__toast__error")).toBeVisible({ timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: doomed.id } })).toMatchObject({
      name: doomed.name,
    });

    // Merge: the source row disappears without a reload, proving the query was invalidated.
    const mergeRow = page.locator(`input[value="${mergeAway.name}"]`).locator("xpath=ancestor::tr");
    await mergeRow.getByRole("combobox").click();
    await page.getByText(renamed, { exact: true }).click();
    await expect(page.locator(`input[value="${mergeAway.name}"]`)).toHaveCount(0, { timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: mergeAway.id } })).toBeNull();

    // Delete: same, via the confirmation dialog.
    const doomedRow = page.locator(`input[value="${doomed.name}"]`).locator("xpath=ancestor::tr");
    await doomedRow.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).last().click();
    await expect(page.locator(`input[value="${doomed.name}"]`)).toHaveCount(0, { timeout: 15000 });
    expect(await prisma.tag.findUnique({ where: { id: doomed.id } })).toBeNull();
  });

  test("rejects a tag mutation from a workspace the caller cannot write to", async ({ page, users }) => {
    const timestamp = Date.now();
    const owner = await users.create({
      email: `tags-owner-${timestamp}@example.com`,
      name: `tags-owner-${timestamp}`,
      workspaceName: "Owner Workspace",
    });
    const outsider = await users.create({
      email: `tags-outsider-${timestamp}@example.com`,
      name: `tags-outsider-${timestamp}`,
      workspaceName: "Outsider Workspace",
    });

    await owner.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const ownerWorkspaceId =
      /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine workspace id from surveys URL");
      })();
    const foreignTag = await prisma.tag.create({
      data: { workspaceId: ownerWorkspaceId, name: `Foreign ${timestamp}` },
    });

    // The route resolves the workspace from the tag, so an outsider holding a valid tag id still cannot
    // rename it. A 404 here instead of 403 would leak that the tag exists.
    await page.context().clearCookies();
    await outsider.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const response = await page.request.patch(`/api/v3/tags/${foreignTag.id}`, {
      data: { name: `Hijacked ${timestamp}` },
    });
    expect(response.status()).toBe(403);
    expect(await prisma.tag.findUnique({ where: { id: foreignTag.id } })).toMatchObject({
      name: foreignTag.name,
    });
  });
});
