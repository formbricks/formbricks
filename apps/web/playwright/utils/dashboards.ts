import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@formbricks/database";
import { type UserFixture, type UsersFixture, login } from "../fixtures/users";

/**
 * A filter an editor locked on the dashboard, as the dashboard stores it (`Dashboard.filters`, ADR-0026):
 * saved with its values, so the server applies it to every chart read, whoever reads it.
 */
export interface SeedLockedFilter {
  id: string;
  field: string;
  operator: "equals" | "notEquals" | "contains" | "notContains" | "gt" | "gte" | "lt" | "lte";
  label: string;
  values: string[];
}

/**
 * Sentiment has a fixed set of values the app knows, so a filter on it is picked from a list without
 * looking anything up in Hub or Cube, which keeps the journeys that use it runnable everywhere.
 */
export const SENTIMENT_FIELD = "FeedbackRecords.sentiment";

export const lockedSentimentFilter = (value = "positive"): SeedLockedFilter => ({
  id: createId(),
  field: SENTIMENT_FIELD,
  operator: "equals",
  label: "Sentiment",
  values: [value],
});

export interface DashboardSetup {
  owner: UserFixture;
  workspaceId: string;
  organizationId: string;
  feedbackDirectoryId: string;
  dashboardId: string;
  dashboardName: string;
  chartId: string;
  chartName: string;
  teamId: string;
}

/**
 * An owner's organization with one workspace, a feedback directory linked to it, one chart on that
 * directory and one dashboard holding the chart, plus a team granted `read` on the workspace (the only
 * way a Dashboard viewer reaches a workspace). Names carry a unique suffix so parallel workers never
 * collide on the `(workspaceId, name)` and `(organizationId, name)` unique keys.
 */
export const setupDashboard = async (
  users: UsersFixture,
  { filters = [] }: { filters?: SeedLockedFilter[] } = {}
): Promise<DashboardSetup> => {
  const owner = await users.create();
  if (!owner.organizationId || !owner.workspaceId) throw new Error("Owner org/workspace not seeded");
  const { organizationId, workspaceId } = owner;
  const suffix = createId().slice(0, 8);

  const directory = await prisma.feedbackDirectory.create({
    data: {
      name: `E2E directory ${suffix}`,
      organizationId,
      workspaces: { create: { workspaceId } },
    },
  });

  const chartName = `Responses ${suffix}`;
  const chart = await prisma.chart.create({
    data: {
      name: chartName,
      type: "bar",
      workspaceId,
      feedbackDirectoryId: directory.id,
      createdBy: owner.id,
      query: { measures: ["FeedbackRecords.count"] },
      config: {},
    },
  });

  const dashboardName = `Field force ${suffix}`;
  const dashboard = await prisma.dashboard.create({
    data: {
      name: dashboardName,
      workspaceId,
      createdBy: owner.id,
      filters: filters as unknown as object[],
      widgets: { create: { chartId: chart.id, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 } },
    },
  });

  const team = await prisma.team.create({
    data: {
      name: `Dashboards ${suffix}`,
      organizationId,
      workspaceTeams: { create: { workspaceId, permission: "read" } },
    },
  });

  return {
    owner,
    workspaceId,
    organizationId,
    feedbackDirectoryId: directory.id,
    dashboardId: dashboard.id,
    dashboardName,
    chartId: chart.id,
    chartName,
    teamId: team.id,
  };
};

/**
 * A Dashboard viewer of the setup's organization, in its team. The fixture creates every user with an
 * organization of their own; that one is deleted so the viewer role is the user's only membership, as it
 * is for someone who joined through an invite.
 */
export const addDashboardViewer = async (
  users: UsersFixture,
  setup: Pick<DashboardSetup, "organizationId" | "teamId">,
  { inTeam = true }: { inTeam?: boolean } = {}
): Promise<UserFixture> => {
  const viewer = await users.create({ withoutWorkspace: true });
  if (viewer.organizationId) {
    const ownOrganizationId = viewer.organizationId;
    await prisma.organization.delete({ where: { id: ownOrganizationId } });
    // `login` waits for the projection of the user's current tenants only; the deleted organization is no
    // longer one of them, so wait here until SpiceDB has dropped it too.
    await waitForOutboxDelivered(ownOrganizationId);
  }
  await prisma.membership.create({
    data: {
      userId: viewer.id,
      organizationId: setup.organizationId,
      role: "dashboard_viewer",
      accepted: true,
    },
  });
  if (inTeam) {
    await prisma.teamUser.create({ data: { teamId: setup.teamId, userId: viewer.id, role: "contributor" } });
  }
  return viewer;
};

const waitForOutboxDelivered = async (id: string): Promise<void> => {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const pending = await prisma.authzedProjectionOutbox.count({
      where: { processedAt: null, deadLetteredAt: null, OR: [{ primaryId: id }, { secondaryId: id }] },
    });
    if (pending === 0) return;
    if (Date.now() >= deadline) throw new Error(`AuthZed outbox rows for ${id} still undelivered after 20s`);
    await delay(50);
  }
};

export const dashboardUrl = (workspaceId: string, dashboardId: string): string =>
  `/workspaces/${workspaceId}/dashboards/${dashboardId}`;

/** Sign a seeded user in on a page of another browser context than the `users` fixture's own. */
export const loginOn = async (page: Page, userId: string): Promise<void> =>
  login(await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: true } }), page);

/** The chips row under a dashboard's toolbar: locked filters first, then this person's own. */
export const filterChips = (page: Page): Locator => page.getByTestId("table-filter-chips");

/**
 * Adds one filter through Filter → Advanced filter: picks the field, checks the operator the dialog picked
 * with it, then picks the value from the field's list, and saves.
 */
export const addFilterRule = async (
  page: Page,
  rule: { field: string; operator: string; value: string }
): Promise<void> => {
  await page.getByTestId("table-filter-button").click();
  await page.getByRole("menuitem", { name: "Advanced filter" }).click();
  const dialog = page.getByRole("dialog", { name: "Advanced filter" });
  await dialog.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: rule.field, exact: true }).click();
  // Picking a field picks its first operator too, so the value control that suits it shows at once.
  await expect(dialog.locator("#condition-0-0-conditionOperator")).toHaveText(rule.operator);
  await dialog.getByRole("button", { name: `${rule.field} value` }).click();
  await page.getByRole("option", { name: rule.value, exact: true }).click();
  await expect(dialog.getByRole("button", { name: `${rule.field} value` })).toHaveText(rule.value);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
};
