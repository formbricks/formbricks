import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-1705 regression: /organizations/[organizationId]/settings/** and /account/settings/** are
// workspace-agnostic routes, so their sidebar must not render the Workspace section (a workspace
// selector pill plus eight workspace-scoped links) for a workspace the shell only inferred from a
// cookie — switching workspaces there is the top bar breadcrumb's job. Those routes render
// OrganizationSettingsSidebar and the in-workspace routes render WorkspaceSettingsSidebar; both end
// in the same OrganizationAndAccountSections, so this also guards that the in-workspace sidebar kept
// its Workspace section.

// The settings shell renders exactly one <aside>, either from SettingsNavigation (the
// workspace-agnostic routes) or from MainNavigation (the in-workspace routes).
const settingsSidebar = (page: Page) => page.getByRole("complementary");

// Every workspace-scoped settings link, in sidebar order.
const WORKSPACE_NAV_LABELS = [
  "General",
  "Team Access",
  "Survey Languages",
  "Connect Your App",
  "Integrations",
  "Appearance",
  "User Actions",
  "Tags",
];

// Distinct, run-unique organization and workspace names so the two switcher pills (which are only
// distinguishable by their accessible name) can never be confused with each other.
const createOwner = async (users: UsersFixture) => {
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const organizationName = `ENG1705 Org ${stamp}`;
  const workspaceName = `ENG1705 Workspace ${stamp}`;
  const user = await users.create({ organizationName, workspaceName });

  if (!user.organizationId || !user.workspaceId) {
    throw new Error("Organization or workspace not seeded for test user");
  }

  return { user, organizationId: user.organizationId, workspaceId: user.workspaceId, workspaceName };
};

// "Nothing is there" passes trivially against a sidebar that has not rendered yet, so wait for the
// Account section (present on every settings route) before asserting the Workspace section's absence.
const expectNoWorkspaceSection = async (page: Page, workspaceName: string) => {
  const sidebar = settingsSidebar(page);

  await expect(sidebar.getByRole("link", { name: "Your Profile", exact: true })).toHaveAttribute(
    "href",
    "/account/settings/profile"
  );

  await expect(sidebar.getByText("Workspace", { exact: true })).toHaveCount(0);
  await expect(sidebar.locator('a[href*="/settings/workspace/"]')).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: workspaceName })).toHaveCount(0);
};

test.describe("Settings sidebar workspace section (ENG-1705)", () => {
  test("organization settings drops the Workspace section and keeps the top bar switcher", async ({
    page,
    users,
  }) => {
    const { user, organizationId, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto(`/organizations/${organizationId}/settings/general`, { waitUntil: "domcontentloaded" });

    const sidebar = settingsSidebar(page);

    await test.step("the Organization and Account sections still render", async () => {
      await expect(sidebar.getByRole("link", { name: "Teams", exact: true })).toHaveAttribute(
        "href",
        `/organizations/${organizationId}/settings/teams`
      );
      await expect(sidebar.getByRole("link", { name: "Your Profile", exact: true })).toHaveAttribute(
        "href",
        "/account/settings/profile"
      );
    });

    await test.step("the Workspace section is gone", async () => {
      await expectNoWorkspaceSection(page, workspaceName);
    });

    await test.step("the top bar breadcrumb is still a workspace switcher", async () => {
      const topBar = page.getByTestId("fb__global-top-control-bar");
      await expect(topBar).toBeVisible();

      await topBar.getByText(workspaceName, { exact: true }).click();

      await expect(page.getByText("Choose workspace", { exact: true })).toBeVisible();
      await expect(page.getByRole("menuitemcheckbox", { name: workspaceName })).toBeVisible();
    });
  });

  test("account settings drops the Workspace section", async ({ page, users }) => {
    const { user, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });

    await expect(
      settingsSidebar(page).getByRole("link", { name: "Your Profile", exact: true })
    ).toHaveAttribute("href", "/account/settings/profile");

    await expectNoWorkspaceSection(page, workspaceName);
  });

  test("workspace settings keeps the Workspace section, its selector pill and every link", async ({
    page,
    users,
  }) => {
    const { user, workspaceId, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto(`/workspaces/${workspaceId}/settings/workspace/general`, {
      waitUntil: "domcontentloaded",
    });

    const sidebar = settingsSidebar(page);

    await expect(sidebar.getByText("Workspace", { exact: true })).toBeVisible();
    await expect(sidebar.locator(`a[href^="/workspaces/${workspaceId}/settings/workspace/"]`)).toHaveText(
      WORKSPACE_NAV_LABELS
    );

    const workspacePill = sidebar.getByRole("button", { name: workspaceName });
    await expect(workspacePill).toBeVisible();

    await workspacePill.click();
    await expect(page.getByRole("menuitemcheckbox", { name: workspaceName })).toBeVisible();
  });

  // AC5 / ENG-1700: the sidebar back arrow is a button that router.push-es the workspace the shell
  // resolved, so assert the resulting URL rather than an href. Visiting the second workspace first
  // points the proxy's formbricks-workspace-id cookie at it, while the no-cookie fallback is the
  // first-created workspace — so landing back on the second one proves the cookie wins.
  test("the back arrow returns to the workspace you came from", async ({ page, users }) => {
    const { user, organizationId } = await createOwner(users);

    // Created after the fixture's workspace, so it is never workspaces[0] — the fallback the shell
    // would pick if the cookie were ignored.
    const secondWorkspace = await prisma.workspace.create({
      data: { name: `ENG1705 Second Workspace ${Date.now()}`, organizationId },
      select: { id: true },
    });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto(`/workspaces/${secondWorkspace.id}/surveys`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/workspaces/${secondWorkspace.id}/surveys`));

    await page.goto(`/organizations/${organizationId}/settings/general`, { waitUntil: "domcontentloaded" });

    await settingsSidebar(page).getByRole("button", { name: "Back", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/workspaces/${secondWorkspace.id}/surveys`));
  });
});
