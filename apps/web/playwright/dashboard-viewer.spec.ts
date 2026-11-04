import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { addDashboardViewer, dashboardUrl, setupDashboard } from "./utils/dashboards";

// ENG-6896 user stories, "Dashboard viewer role": a Dashboard viewer lands on the dashboards of the
// workspaces its teams can access, is kept out of the rest of the product, reads charts and cannot edit a
// dashboard. ADR-0025 decides the role in SpiceDB. Filtering, and locked filters, are in
// dashboard-filters.spec.ts.

test.describe("Dashboard viewer", () => {
  test("lands on its dashboards and opens one it was granted @smoke", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);

    await viewer.login();

    await expect(page).toHaveURL(new RegExp(`/workspaces/${setup.workspaceId}/dashboards/?$`));
    await page.getByRole("link", { name: setup.dashboardName }).click();
    await expect(page).toHaveURL(new RegExp(dashboardUrl(setup.workspaceId, setup.dashboardId)));
    await expect(page.getByText(setup.chartName)).toBeVisible();
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

  test("reads a dashboard but has no way to edit it", async ({ page, users }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);
    await viewer.login();

    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));

    const toolbar = page.getByRole("toolbar", { name: "Action buttons" });
    await expect(toolbar.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByText(setup.chartName)).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add charts" })).toHaveCount(0);

    // The edit shortcut does nothing for someone who cannot edit: the view stays as it is.
    await page.locator("body").press("e");
    await expect(toolbar.getByRole("button", { name: "Save" })).toHaveCount(0);
    await expect(toolbar.getByRole("button", { name: "Refresh" })).toBeVisible();
    // A viewer filters for themselves, but has nothing to lock for everyone.
    await expect(page.getByTestId("table-filter-button")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lock for everyone" })).toHaveCount(0);
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
