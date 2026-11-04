import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { addDashboardViewer, dashboardUrl, setupDashboard, userIdFilter } from "./utils/dashboards";

// ENG-6896 user stories, "Dashboard viewer role": a Dashboard viewer lands on the dashboards of the
// workspaces its teams can access, sees nothing else of the product, reads charts and uses the
// dashboard's filters, and cannot edit a dashboard. ADR-0023 decides the role in SpiceDB.

test.describe("Dashboard viewer", () => {
  test("lands on its dashboards and sees only Dashboards in the navigation @smoke", async ({
    page,
    users,
  }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);

    await viewer.login();

    await expect(page).toHaveURL(new RegExp(`/workspaces/${setup.workspaceId}/dashboards/?$`));
    await expect(page.getByRole("link", { name: setup.dashboardName })).toBeVisible();

    // The app calls the dashboard list "Overview" (`common.dashboards`); for a viewer it is the only item.
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
    for (const hidden of [
      "Surveys",
      "Contacts",
      "Creatives",
      "Feedback Data",
      "Analysis",
      "Workflows",
      "Settings",
    ]) {
      await expect(
        sidebar.getByRole("link", { name: hidden, exact: true }),
        `${hidden} is hidden`
      ).toHaveCount(0);
    }
  });

  test("is sent back to its dashboards from a direct link to surveys, responses or contacts", async ({
    page,
    users,
  }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);
    const survey = await prisma.survey.findFirstOrThrow({
      where: { workspaceId: setup.workspaceId },
      select: { id: true },
    });

    await viewer.login();

    const base = `/workspaces/${setup.workspaceId}`;
    for (const url of [
      `${base}/surveys`,
      `${base}/surveys/${survey.id}/summary`,
      `${base}/surveys/${survey.id}/responses`,
      `${base}/contacts`,
      `${base}/unify/sources`,
    ]) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page, `viewer must not stay on ${url}`).toHaveURL(
        new RegExp(`/workspaces/${setup.workspaceId}/dashboards/?$`)
      );
    }
  });

  test("cannot read surveys or responses through API v3 with its session", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);
    await viewer.login();

    for (const path of ["/api/v3/surveys", "/api/v3/responses"]) {
      const response = await page.request.get(path, { params: { workspaceId: setup.workspaceId } });
      expect(response.status(), `${path} answers ${await response.text()}`).toBe(403);
    }

    // The dashboard itself stays readable through v3.
    const dashboard = await page.request.get(`/api/v3/dashboards/${setup.dashboardId}`);
    expect(dashboard.status(), await dashboard.text()).toBe(200);
  });

  test("reads a dashboard but has no way to edit it", async ({ page, users }) => {
    const setup = await setupDashboard(users, { filters: [userIdFilter()] });
    const viewer = await addDashboardViewer(users, setup);
    await viewer.login();

    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));

    const toolbar = page.getByRole("toolbar", { name: "Action buttons" });
    await expect(toolbar.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add charts" })).toHaveCount(0);
    await expect(page.getByText(setup.chartName)).toBeVisible();

    // The edit shortcut does nothing for someone who cannot edit: no edit-mode controls appear.
    await page.locator("body").press("e");
    await expect(page.getByRole("button", { name: "Add filter" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Save" })).toHaveCount(0);

    // A direct write through v3 is refused as well.
    const write = await page.request.patch(`/api/v3/dashboards/${setup.dashboardId}`, {
      data: { name: "Renamed by a viewer" },
    });
    expect(write.status(), await write.text()).toBe(403);
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.name).toBe(setup.dashboardName);
  });

  test("picks a dashboard filter value and finds it still set on the next visit", async ({ page, users }) => {
    const filter = userIdFilter("User");
    const setup = await setupDashboard(users, { filters: [filter] });
    const viewer = await addDashboardViewer(users, setup);
    await viewer.login();

    const url = dashboardUrl(setup.workspaceId, setup.dashboardId);
    await page.goto(url);

    const bar = page.getByTestId("dashboard-filter-bar");
    await bar.getByRole("button", { name: "Edit User" }).click();
    const valueInput = page.getByLabel("User equals");
    await valueInput.fill("rep-42");
    await valueInput.press("Enter");

    await expect(bar.getByRole("button", { name: "Edit User" })).toContainText("rep-42");
    await expect(page).toHaveURL(/picks/);

    // A fresh visit without the picks in the URL restores them from this person's dashboard cookie.
    await page.goto("about:blank");
    await page.goto(url);
    await expect(bar.getByRole("button", { name: "Edit User" })).toContainText("rep-42");

    // Clearing the pick is remembered too.
    await bar.getByRole("button", { name: "Remove User" }).click();
    await expect(bar.getByRole("button", { name: "Edit User" })).not.toContainText("rep-42");
    await page.goto("about:blank");
    await page.goto(url);
    await expect(bar.getByRole("button", { name: "Edit User" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Edit User" })).not.toContainText("rep-42");

    // Picks are this person's view: the dashboard's saved filters are unchanged.
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.filters).toEqual([filter]);
  });

  test("without a team grant sees the page explaining there are no dashboards", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup, { inTeam: false });
    await viewer.login();

    await expect(page.getByText("No dashboards shared with you yet")).toBeVisible();
    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));
    await expect(page.getByText(setup.dashboardName)).toHaveCount(0);
  });
});

test.describe("Inviting Dashboard viewers", () => {
  const openInviteModal = async (page: import("@playwright/test").Page, organizationId: string) => {
    await page.goto(`/organizations/${organizationId}/settings/teams`);
    await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Invite member" }).click();
  };

  test("an owner invites one Dashboard viewer into a team", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const email = `viewer-${Date.now()}-${test.info().workerIndex}@example.com`;
    await setup.owner.login();
    await openInviteModal(page, setup.organizationId);

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full Name").fill("Area Manager");
    await dialog.getByLabel("Email").fill(email);

    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Dashboard viewer/ }).click();
    await expect(dialog.getByText(/Dashboard viewers only see dashboards/)).toBeVisible();

    await dialog.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(dialog).toBeHidden();

    const row = page.locator("#singleMemberInfo").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
    await expect(row.getByText("Dashboard viewer")).toBeVisible();

    const invite = await prisma.invite.findFirstOrThrow({
      where: { email, organizationId: setup.organizationId },
    });
    expect(invite.role).toBe("dashboard_viewer");
  });

  test("an owner bulk-invites 200 Dashboard viewers from a CSV", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const team = await prisma.team.findUniqueOrThrow({ where: { id: setup.teamId } });
    const stamp = `${Date.now()}-${test.info().workerIndex}`;
    const rows = Array.from(
      { length: 200 },
      (_, i) => `Rep ${i},rep-${i}-${stamp}@example.com,Dashboard viewer,"${team.name}"`
    );
    const csv = ["Full Name,Email Address,Organization Role,Teams", ...rows].join("\n");

    await setup.owner.login();
    await openInviteModal(page, setup.organizationId);
    await page.getByRole("dialog").getByText("Bulk Invite", { exact: true }).click();

    await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
      name: "viewers.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText("200 rows detected")).toBeVisible();
    await page.getByRole("button", { name: "Import" }).click();

    await expect
      .poll(
        () =>
          prisma.invite.count({
            where: {
              organizationId: setup.organizationId,
              role: "dashboard_viewer",
              email: { endsWith: `${stamp}@example.com` },
            },
          }),
        { timeout: 60_000 }
      )
      .toBe(200);
    const sample = await prisma.invite.findFirstOrThrow({
      where: { organizationId: setup.organizationId, email: `rep-0-${stamp}@example.com` },
    });
    expect(sample.teamIds).toEqual([setup.teamId]);
  });
});
