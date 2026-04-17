import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

const SURVEYS_PER_PAGE = 12;

const getUserIdForEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }

  return user.id;
};

const getWorkspaceIdsForEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      memberships: {
        select: {
          organizationId: true,
          organization: {
            select: {
              projects: {
                select: {
                  id: true,
                  environments: {
                    where: {
                      type: "development",
                    },
                    select: {
                      id: true,
                    },
                    take: 1,
                  },
                },
                take: 1,
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  const membership = user?.memberships[0];
  const project = membership?.organization.projects[0];
  const environment = project?.environments[0];

  if (!user || !membership || !project || !environment) {
    throw new Error(`Workspace not found for email: ${email}`);
  }

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    projectId: project.id,
    environmentId: environment.id,
  };
};

const createSurveySeed = async ({
  environmentId,
  userId,
  name,
  status = "draft",
  type = "link",
}: {
  environmentId: string;
  userId: string;
  name: string;
  status?: "draft" | "inProgress" | "paused" | "completed";
  type?: "link" | "app";
}) => {
  return prisma.survey.create({
    data: {
      environmentId,
      createdBy: userId,
      name,
      status,
      type,
    },
  });
};

test.describe("Survey overview", () => {
  test("loads surveys, applies filters and sort, and paginates with load more", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `overview-v3-${timestamp}@example.com`;
    const name = `overview-v3-${timestamp}`;
    const targetSurveyName = `Target Survey ${timestamp}`;
    const pausedSurveyName = `Paused Survey ${timestamp}`;
    const appSurveyName = `App Survey ${timestamp}`;
    const paginatedSurveyName = `Paginated Survey ${timestamp}`;
    const user = await users.create({
      email,
      name,
      projectName: "Overview Workspace",
    });
    const userId = await getUserIdForEmail(email);

    await user.login();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    const environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine environment id from surveys URL");
      })();

    const surveyDefinitions: Array<{
      name: string;
      status: "draft" | "paused";
      type: "link" | "app";
    }> = [
      { name: paginatedSurveyName, status: "draft", type: "link" },
      { name: "Overview Survey 01", status: "draft", type: "link" },
      { name: "Overview Survey 02", status: "paused", type: "link" },
      { name: "Overview Survey 03", status: "draft", type: "link" },
      { name: "Overview Survey 04", status: "paused", type: "link" },
      { name: "Overview Survey 05", status: "draft", type: "link" },
      { name: "Overview Survey 06", status: "paused", type: "link" },
      { name: "Overview Survey 07", status: "draft", type: "link" },
      { name: "Overview Survey 08", status: "paused", type: "link" },
      { name: "Overview Survey 09", status: "draft", type: "link" },
      { name: appSurveyName, status: "draft", type: "app" },
      { name: pausedSurveyName, status: "paused", type: "link" },
      { name: targetSurveyName, status: "draft", type: "link" },
    ];

    for (const surveyDefinition of surveyDefinitions) {
      await createSurveySeed({
        environmentId,
        userId,
        name: surveyDefinition.name,
        status: surveyDefinition.status,
        type: surveyDefinition.type,
      });
    }

    await page.reload();
    await expect(page.locator(".surveyFilterDropdown").filter({ hasText: "Created by" })).toHaveCount(0);
    await expect(page.getByText(targetSurveyName, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(pausedSurveyName, { exact: true })).toBeVisible();
    await expect(page.getByText(appSurveyName, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();

    await page.getByPlaceholder("Search by survey name").fill(targetSurveyName);
    await expect(page.getByText(targetSurveyName, { exact: true })).toBeVisible();
    await expect(page.getByText(pausedSurveyName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(appSurveyName, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(pausedSurveyName, { exact: true })).toBeVisible();

    await page.locator(".surveyFilterDropdown").filter({ hasText: "Status" }).click();
    await page.getByRole("menuitem", { name: "Draft" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(targetSurveyName, { exact: true })).toBeVisible();
    await expect(page.getByText(pausedSurveyName, { exact: true })).toHaveCount(0);

    await page.locator(".surveyFilterDropdown").filter({ hasText: "Type" }).click();
    await page.getByRole("menuitem", { name: "Link" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(appSurveyName, { exact: true })).toHaveCount(0);

    await page.locator(".surveyFilterDropdown").filter({ hasText: "Sort by" }).click();
    await page.getByRole("menuitem", { name: "Created at" }).click();
    await expect(
      page.locator(".surveyFilterDropdown").filter({ hasText: "Sort by: Created at" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(appSurveyName, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();

    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByText(paginatedSurveyName, { exact: true })).toBeVisible();
  });

  test("keeps draft-only actions and optimistically deletes the last survey into the template state", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const email = `overview-delete-${timestamp}@example.com`;
    const name = `overview-delete-${timestamp}`;
    const surveyName = `Delete Me ${timestamp}`;
    const user = await users.create({
      email,
      name,
      projectName: "Delete Workspace",
    });
    const userId = await getUserIdForEmail(email);

    await user.login();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    const environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine environment id from surveys URL");
      })();
    const survey = await createSurveySeed({
      environmentId,
      userId,
      name: surveyName,
      status: "draft",
      type: "link",
    });

    await page.reload();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible({ timeout: 10000 });

    let releaseDeleteRequest: (() => void) | undefined;
    let resolveDeleteStarted: (() => void) | undefined;
    const deleteStarted = new Promise<void>((resolve) => {
      resolveDeleteStarted = resolve;
    });
    await page.route(`**/api/v3/surveys/${survey.id}`, async (route) => {
      resolveDeleteStarted?.();
      await new Promise<void>((resolveDelete) => {
        releaseDeleteRequest = resolveDelete;
      });
      await route.continue();
    });

    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await expect(page.getByText("Duplicate", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Copy...", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Preview", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("copy-link")).toHaveCount(0);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await deleteStarted;
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();
    await expect(page.getByText("Start from scratch", { exact: true })).toBeVisible();

    releaseDeleteRequest?.();
    await expect(page.getByText("Survey deleted successfully", { exact: true })).toBeVisible();
  });

  test("restores the survey when delete fails", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `overview-delete-failure-${timestamp}@example.com`;
    const name = `overview-delete-failure-${timestamp}`;
    const surveyName = `Rollback Me ${timestamp}`;
    const user = await users.create({
      email,
      name,
      projectName: "Rollback Workspace",
    });
    const userId = await getUserIdForEmail(email);

    await user.login();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    const environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine environment id from surveys URL");
      })();
    const survey = await createSurveySeed({
      environmentId,
      userId,
      name: surveyName,
      status: "draft",
      type: "link",
    });

    await page.reload();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible({ timeout: 10000 });

    await page.route(`**/api/v3/surveys/${survey.id}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 500,
        contentType: "application/problem+json",
        body: JSON.stringify({
          title: "Internal Server Error",
          status: 500,
          detail: "Delete failed",
          requestId: "playwright-delete-failure",
        }),
      });
    });

    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible();
    await expect(page.getByText("Delete failed", { exact: true })).toBeVisible();
  });

  test("shows preview and copy link for published link surveys and hides the dropdown when no actions are available", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const email = `overview-actions-${timestamp}@example.com`;
    const name = `overview-actions-${timestamp}`;
    const linkSurveyName = `Published Link ${timestamp}`;
    const appSurveyName = `Read Only App ${timestamp}`;
    const user = await users.create({
      email,
      name,
      projectName: "Action Workspace",
    });
    const { userId, organizationId, projectId, environmentId } = await getWorkspaceIdsForEmail(email);

    await prisma.membership.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data: {
        role: "member",
      },
    });

    const team = await prisma.team.create({
      data: {
        name: `Read Only Team ${timestamp}`,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    await prisma.teamUser.create({
      data: {
        teamId: team.id,
        userId,
        role: "contributor",
      },
    });

    await prisma.projectTeam.create({
      data: {
        teamId: team.id,
        projectId,
        permission: "read",
      },
    });

    await user.login();
    await page.goto(`/environments/${environmentId}/surveys`);

    await createSurveySeed({
      environmentId,
      userId,
      name: linkSurveyName,
      status: "paused",
      type: "link",
    });
    await createSurveySeed({
      environmentId,
      userId,
      name: appSurveyName,
      status: "completed",
      type: "app",
    });

    await page.reload();
    const linkRow = page.locator("div.relative.block", { has: page.getByText(linkSurveyName, { exact: true }) });
    await linkRow.locator("[data-testid='survey-dropdown-trigger']").click();
    await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
    await expect(page.getByTestId("copy-link")).toBeVisible();

    const appRow = page.locator("div.relative.block", { has: page.getByText(appSurveyName, { exact: true }) });
    await expect(appRow.locator("[data-testid='survey-dropdown-trigger']")).toHaveCount(0);
  });
});
