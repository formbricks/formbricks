import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

test("requires workspace name confirmation before deleting a workspace", async ({ page, users }) => {
  const timestamp = Date.now();
  const email = `workspace-delete-${timestamp}@example.com`;
  const workspaceName = `Delete Workspace ${timestamp}`;
  const remainingWorkspaceName = `Remaining Workspace ${timestamp}`;
  const user = await users.create({
    email,
    name: `workspace-delete-${timestamp}`,
    workspaceName,
  });

  if (!user.workspaceId || !user.organizationId) {
    throw new Error("Workspace or organization not seeded for test user");
  }

  const remainingWorkspace = await prisma.workspace.create({
    data: {
      name: remainingWorkspaceName,
      organizationId: user.organizationId,
    },
    select: { id: true },
  });

  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/settings/workspace/general`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();

  await page.locator("#deleteWorkspaceConfirmation").fill(workspaceName.toUpperCase());
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Workspace deleted successfully", { exact: true })).toBeVisible();
  await page.waitForURL(new RegExp(`/workspaces/${remainingWorkspace.id}`));
  await expect.poll(async () => prisma.workspace.findUnique({ where: { id: user.workspaceId! } })).toBeNull();
});
