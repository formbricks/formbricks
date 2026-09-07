import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

test("keeps the current organization when opening account settings", async ({ page, users }) => {
  const timestamp = Date.now();

  // Created before the user's own organization so it is the first row the (createdAt-ordered)
  // organization query returns — the organization account settings switched to before the fix.
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
    email: `account-settings-org-${timestamp}@example.com`,
    name: `account-settings-org-${timestamp}`,
    workspaceName: `Own Workspace ${timestamp}`,
  });

  if (!user.workspaceId || !user.organizationId) {
    throw new Error("Workspace or organization not seeded for test user");
  }

  await prisma.membership.create({
    data: { userId: user.id, organizationId: otherOrganization.id, role: "owner", accepted: true },
  });

  // The other organization needs a survey so the onboarding redirect does not interfere with login.
  await prisma.survey.create({
    data: {
      workspaceId: otherOrganization.workspaces[0].id,
      createdBy: user.id,
      name: "Other Organization Seed Survey",
      status: "draft",
      type: "link",
    },
  });

  await user.login();
  // Login lands on "/", which client-side redirects into a workspace — of the other organization, as
  // it owns the first workspace id "/" collects. Let it settle so it cannot race the navigation below.
  await page.waitForURL("**/workspaces/**");

  // Visiting the workspace makes it the active one (the proxy stores it in a cookie).
  await page.goto(`/workspaces/${user.workspaceId}/surveys`, { waitUntil: "domcontentloaded" });
  await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });

  // The sidebar's organization links carry the organization the settings shell resolved.
  await expect(
    page.locator(`a[href^="/organizations/${user.organizationId}/settings/"]`).first()
  ).toBeVisible();
  await expect(page.locator(`a[href^="/organizations/${otherOrganization.id}/"]`)).toHaveCount(0);

  // The workspace section still shows the workspace we came from, not another organization's.
  await expect(page.locator(`a[href^="/workspaces/${user.workspaceId}/settings/"]`).first()).toBeVisible();
});
