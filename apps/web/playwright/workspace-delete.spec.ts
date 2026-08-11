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

  await prisma.survey.create({
    data: {
      workspaceId: remainingWorkspace.id,
      createdBy: user.id,
      name: "Remaining Workspace Seed Survey",
      status: "draft",
      type: "link",
    },
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

  await expect(page.getByText("Workspace deleted successfully", { exact: true }).first()).toBeVisible();
  await page.waitForURL(`**/workspaces/${remainingWorkspace.id}**`);
  await expect.poll(async () => prisma.workspace.findUnique({ where: { id: user.workspaceId! } })).toBeNull();
});

test("stays in the same organization when deleting a workspace as a member of multiple organizations", async ({
  page,
  users,
}) => {
  const timestamp = Date.now();
  const workspaceName = `Delete Workspace ${timestamp}`;

  // Created before the user's own organization so it is the first row the unordered organization query
  // returns — that is the organization the pre-fix "/" fallback dropped the user into.
  const otherOrganization = await prisma.organization.create({
    data: {
      name: `Other Organization ${timestamp}`,
      billing: {
        create: {
          limits: { workspaces: 3, monthly: { responses: 1500 } },
          stripeCustomerId: null,
          usageCycleAnchor: new Date(),
        },
      },
      workspaces: { create: { name: `Other Organization Workspace ${timestamp}` } },
    },
    select: { id: true, workspaces: { select: { id: true } } },
  });
  const otherOrganizationWorkspaceId = otherOrganization.workspaces[0].id;

  const user = await users.create({
    email: `workspace-delete-multi-org-${timestamp}@example.com`,
    name: `workspace-delete-multi-org-${timestamp}`,
    workspaceName,
  });

  if (!user.workspaceId || !user.organizationId) {
    throw new Error("Workspace or organization not seeded for test user");
  }

  await prisma.membership.create({
    data: { userId: user.id, organizationId: otherOrganization.id, role: "owner", accepted: true },
  });

  const remainingWorkspace = await prisma.workspace.create({
    data: {
      name: `Remaining Workspace ${timestamp}`,
      organizationId: user.organizationId,
    },
    select: { id: true },
  });

  // Both organizations need a survey so the onboarding redirect does not interfere.
  await prisma.survey.createMany({
    data: [remainingWorkspace.id, otherOrganizationWorkspaceId].map((workspaceId) => ({
      workspaceId,
      createdBy: user.id,
      name: "Multi Org Seed Survey",
      status: "draft" as const,
      type: "link" as const,
    })),
  });

  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/settings/workspace/general`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.locator("#deleteWorkspaceConfirmation").fill(workspaceName);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await page.waitForURL(`**/workspaces/${remainingWorkspace.id}**`);
  expect(page.url()).not.toContain(otherOrganizationWorkspaceId);
});
