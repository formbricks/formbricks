import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-1705 regression: /organizations/[organizationId]/settings/** and /account/settings/** are
// workspace-agnostic routes — no workspaceId in the URL — so the top bar must not render the
// workspace breadcrumb there, only the organization one. The settings sidebar is deliberately
// untouched and still shows its Workspace section on those routes, so every test below also asserts
// the sidebar is intact: that is the guard against the breadcrumb change leaking into the sidebar.

// The settings shell renders exactly one <aside>, either from SettingsNavigation (the
// workspace-agnostic routes) or from MainNavigation (the in-workspace routes).
const settingsSidebar = (page: Page) => page.getByRole("complementary");
const topBar = (page: Page) => page.getByTestId("fb__global-top-control-bar");

// Every workspace-scoped settings link, in sidebar order.
const WORKSPACE_NAV_LABELS = [
  "General",
  "Team Access",
  "Survey Languages",
  "Installation",
  "Integrations",
  "Appearance",
  "User Actions",
  "Tags",
];

// Distinct, run-unique organization and workspace names so the breadcrumb and the sidebar pill
// (which are only distinguishable by their accessible name) can never be confused with each other.
const createOwner = async (users: UsersFixture) => {
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const organizationName = `ENG1705 Org ${stamp}`;
  const workspaceName = `ENG1705 Workspace ${stamp}`;
  const user = await users.create({ organizationName, workspaceName });

  if (!user.organizationId || !user.workspaceId) {
    throw new Error("Organization or workspace not seeded for test user");
  }

  return {
    user,
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    organizationName,
    workspaceName,
  };
};

// The sidebar keeps its Workspace section on every settings route. Asserting it positively also
// makes the breadcrumb's absence assertion meaningful: the page has demonstrably rendered.
const expectSidebarWorkspaceSection = async (page: Page, workspaceId: string, workspaceName: string) => {
  const sidebar = settingsSidebar(page);

  await expect(sidebar.getByText("Workspace", { exact: true })).toBeVisible();
  await expect(sidebar.locator(`a[href^="/workspaces/${workspaceId}/settings/workspace/"]`)).toHaveText(
    WORKSPACE_NAV_LABELS
  );
  await expect(sidebar.getByRole("button", { name: workspaceName })).toBeVisible();
};

test.describe("Settings workspace breadcrumb (ENG-1705)", () => {
  test("organization settings hides the workspace breadcrumb and keeps the sidebar section", async ({
    page,
    users,
  }) => {
    const { user, organizationId, workspaceId, organizationName, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto(`/organizations/${organizationId}/settings/general`, { waitUntil: "domcontentloaded" });

    await test.step("the sidebar is unchanged", async () => {
      await expectSidebarWorkspaceSection(page, workspaceId, workspaceName);
      await expect(settingsSidebar(page).getByRole("link", { name: "Teams", exact: true })).toHaveAttribute(
        "href",
        `/organizations/${organizationId}/settings/teams`
      );
    });

    await test.step("the top bar keeps the organization breadcrumb and drops the workspace one", async () => {
      // Scoped to the top bar: the workspace name legitimately appears in the sidebar pill, so an
      // unscoped assertion would fail for the wrong reason.
      await expect(topBar(page).getByText(organizationName, { exact: true })).toBeVisible();
      await expect(topBar(page).getByText(workspaceName, { exact: true })).toHaveCount(0);
    });
  });

  test("account settings hides the workspace breadcrumb and keeps the sidebar section", async ({
    page,
    users,
  }) => {
    const { user, workspaceId, organizationName, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });

    await expectSidebarWorkspaceSection(page, workspaceId, workspaceName);
    await expect(
      settingsSidebar(page).getByRole("link", { name: "Your Profile", exact: true })
    ).toHaveAttribute("href", "/account/settings/profile");

    await expect(topBar(page).getByText(organizationName, { exact: true })).toBeVisible();
    await expect(topBar(page).getByText(workspaceName, { exact: true })).toHaveCount(0);
  });

  test("workspace settings keeps both the workspace breadcrumb and the sidebar section", async ({
    page,
    users,
  }) => {
    const { user, workspaceId, workspaceName } = await createOwner(users);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await page.goto(`/workspaces/${workspaceId}/settings/workspace/general`, {
      waitUntil: "domcontentloaded",
    });

    await expectSidebarWorkspaceSection(page, workspaceId, workspaceName);

    const workspacePill = settingsSidebar(page).getByRole("button", { name: workspaceName });
    await workspacePill.click();
    await expect(page.getByRole("menuitemcheckbox", { name: workspaceName })).toBeVisible();

    // The breadcrumb is only suppressed on the workspace-agnostic routes. Keeping this positive
    // assertion is what stops the two tests above from passing against a top bar that never renders
    // a workspace crumb at all.
    await expect(topBar(page).getByText(workspaceName, { exact: true })).toBeVisible();
  });

  // ENG-1700: the sidebar back arrow is a button that router.push-es the workspace the shell
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
