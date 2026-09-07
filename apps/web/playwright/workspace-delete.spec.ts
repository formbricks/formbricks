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

  // The stored "last workspace" must no longer name the deleted one. Exercised through its real
  // reader: "/" resolves a landing workspace from it across every organization the user belongs to.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(`**/workspaces/${remainingWorkspace.id}**`);

  // Account settings carry no organization in the URL and resolve it from the workspace cookie.
  // This lands on a /workspaces/:id path, so the proxy refreshes that cookie on its own — the spec
  // below covers the branch where it does not.
  await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });
  // `domcontentloaded` returns before the settings shell has resolved its organization, and this
  // route compiles cold on CI, so the default 5s expect timeout is not enough under worker
  // contention. The positive assertion has to settle first: it is what proves the sidebar rendered
  // at all, and without it the `toHaveCount(0)` below would pass on an empty page.
  await expect(
    page.locator(`a[href^="/organizations/${user.organizationId}/settings/"]`).first()
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`a[href^="/organizations/${otherOrganization.id}/"]`)).toHaveCount(0);
});

test("still runs the onboarding redirect when the surviving workspace has no survey", async ({
  page,
  users,
}) => {
  const timestamp = Date.now();
  const workspaceName = `Delete Workspace ${timestamp}`;
  const user = await users.create({
    email: `workspace-delete-onboarding-${timestamp}@example.com`,
    name: `workspace-delete-onboarding-${timestamp}`,
    workspaceName,
  });

  if (!user.workspaceId || !user.organizationId) {
    throw new Error("Workspace or organization not seeded for test user");
  }

  // Deliberately no survey: the workspace we land on is the one the onboarding gate reacts to.
  const remainingWorkspace = await prisma.workspace.create({
    data: {
      name: `Remaining Workspace ${timestamp}`,
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
  await page.locator("#deleteWorkspaceConfirmation").fill(workspaceName);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  // Same destination the old "/" hop produced for an organization whose oldest workspace has no
  // survey yet ("/plan" on Cloud, "/survey" self-hosted).
  await page.waitForURL(`**/organizations/${user.organizationId}/workspaces/new/**`);

  // The gate has to win over the surviving workspace, not just eventually redirect to it.
  expect(page.url()).toContain(`/organizations/${user.organizationId}/workspaces/new/`);
  expect(page.url()).not.toContain(`/workspaces/${remainingWorkspace.id}`);
  await expect.poll(async () => prisma.workspace.findUnique({ where: { id: user.workspaceId! } })).toBeNull();
});

test("keeps the organization in account settings when the delete lands on the onboarding flow", async ({
  page,
  users,
}) => {
  const timestamp = Date.now();
  const workspaceName = `Delete Workspace ${timestamp}`;

  // Seeded before the user's own organization, so it is the row the createdAt-ordered organization
  // query returns first — the organization the `organizations[0]` fallback resolves to.
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

  const user = await users.create({
    email: `workspace-delete-onboarding-org-${timestamp}@example.com`,
    name: `workspace-delete-onboarding-org-${timestamp}`,
    workspaceName,
  });

  if (!user.workspaceId || !user.organizationId) {
    throw new Error("Workspace or organization not seeded for test user");
  }

  await prisma.membership.create({
    data: { userId: user.id, organizationId: otherOrganization.id, role: "owner", accepted: true },
  });

  await prisma.survey.create({
    data: {
      workspaceId: otherOrganization.workspaces[0].id,
      createdBy: user.id,
      name: "Other Organization Seed Survey",
      status: "draft",
      type: "link",
    },
  });

  // Deliberately no survey, so the deletion lands on the onboarding flow rather than on a
  // /workspaces/:id path — the branch where the proxy does not refresh the workspace cookie.
  await prisma.workspace.create({
    data: { name: `Remaining Workspace ${timestamp}`, organizationId: user.organizationId },
    select: { id: true },
  });

  await user.login();
  // Visiting the workspace makes it the active one (the proxy stores it in the cookie).
  await page.goto(`/workspaces/${user.workspaceId}/settings/workspace/general`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.locator("#deleteWorkspaceConfirmation").fill(workspaceName);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await page.waitForURL(`**/organizations/${user.organizationId}/workspaces/new/**`);

  // The cookie still named the workspace we just deleted until the delete action started repointing
  // it, which sent account settings to the *other* organization via the organizations[0] fallback.
  await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });
  // `domcontentloaded` returns before the settings shell has resolved its organization, and this
  // route compiles cold on CI, so the default 5s expect timeout is not enough under worker
  // contention. The positive assertion has to settle first: it is what proves the sidebar rendered
  // at all, and without it the `toHaveCount(0)` below would pass on an empty page.
  await expect(
    page.locator(`a[href^="/organizations/${user.organizationId}/settings/"]`).first()
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`a[href^="/organizations/${otherOrganization.id}/"]`)).toHaveCount(0);
});
