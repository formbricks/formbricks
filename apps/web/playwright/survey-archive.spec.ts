import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

const getUserIdForEmail = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }
  return user.id;
};

const createSurveySeed = async ({
  workspaceId,
  userId,
  name,
  status = "draft",
}: {
  workspaceId: string;
  userId: string;
  name: string;
  status?: "draft" | "inProgress" | "paused" | "completed";
}) => {
  return prisma.survey.create({
    data: { workspaceId, createdBy: userId, name, status, type: "link" },
  });
};

test.describe("Survey archive @slow", () => {
  test("archives an in-progress survey, filters, restores, then deletes it forever", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const email = `archive-${timestamp}@example.com`;
    const surveyName = `Archive Me ${timestamp}`;
    const user = await users.create({
      email,
      name: `archive-${timestamp}`,
      workspaceName: "Archive Workspace",
    });
    const userId = await getUserIdForEmail(email);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const workspaceId =
      /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine workspace id from surveys URL");
      })();

    const survey = await createSurveySeed({ workspaceId, userId, name: surveyName, status: "inProgress" });
    // Keep the list to a single survey so assertions stay deterministic.
    await prisma.survey.deleteMany({ where: { workspaceId, id: { not: survey.id } } });

    await page.reload();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible({ timeout: 10000 });

    // With nothing archived yet, "Archived" is still offered and behaves like any other status:
    // the selection sticks and the list is empty, rather than silently unticking itself.
    await page.locator(".surveyFilterDropdown").filter({ hasText: "Status" }).click();
    await page.getByRole("menuitem", { name: "Archived" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible();

    // Archive an in-progress survey → hard warning with "Stop and archive".
    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await page.getByTestId("archive-survey").click();
    await page.getByRole("dialog").getByRole("button", { name: "Stop and archive", exact: true }).click();

    await expect(page.getByText("Survey archived", { exact: true })).toBeVisible();
    // Hidden from the default list. The workspace now holds nothing but this archived survey, so the
    // toolbar has to stay put instead of falling back to the "create your first survey" onboarding.
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();

    // "Archived" is always offered in the Status filter; selecting it reveals the survey.
    await page.locator(".surveyFilterDropdown").filter({ hasText: "Status" }).click();
    await page.getByRole("menuitem", { name: "Archived" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible();

    // Archived card exposes only Restore and Delete.
    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await expect(page.getByTestId("restore-survey")).toBeVisible();
    await expect(page.getByTestId("delete-survey-forever")).toBeVisible();
    await expect(page.getByTestId("archive-survey")).toHaveCount(0);
    await expect(page.getByTestId("duplicate-survey")).toHaveCount(0);

    // Restore → the survey stops matching the archived filter and leaves the view, exactly like a
    // survey that leaves any other status filter. Clearing the filter brings it back.
    await page.getByTestId("restore-survey").click();
    await expect(page.getByText("Survey restored", { exact: true })).toBeVisible();
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible();

    // Archive again, then permanently delete it from the archived view.
    // The restored survey is paused now (archiving an in-progress survey pauses it, and restore keeps
    // the status), so this time the soft "Archive" confirm is shown instead of "Stop and archive".
    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await page.getByTestId("archive-survey").click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Survey archived", { exact: true })).toBeVisible();

    await page.locator(".surveyFilterDropdown").filter({ hasText: "Status" }).click();
    await page.getByRole("menuitem", { name: "Archived" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible();

    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await page.getByTestId("delete-survey-forever").click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    // The permanent delete runs a cascading transaction and can take several seconds, so allow
    // extra time for the success toast (which only fires once the request resolves).
    await expect(page.getByText("Survey deleted successfully", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();
  });

  test("shows a soft warning when archiving a draft survey", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `archive-draft-${timestamp}@example.com`;
    const surveyName = `Draft Archive ${timestamp}`;
    const user = await users.create({
      email,
      name: `archive-draft-${timestamp}`,
      workspaceName: "Draft Archive Workspace",
    });
    const userId = await getUserIdForEmail(email);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const workspaceId =
      /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine workspace id from surveys URL");
      })();

    const survey = await createSurveySeed({ workspaceId, userId, name: surveyName, status: "draft" });
    await prisma.survey.deleteMany({ where: { workspaceId, id: { not: survey.id } } });

    await page.reload();
    await expect(page.getByText(surveyName, { exact: true })).toBeVisible({ timeout: 10000 });

    await page.locator("[data-testid='survey-dropdown-trigger']").click();
    await page.getByTestId("archive-survey").click();
    // Draft surveys get the soft warning with a plain "Archive" confirm (not "Stop and archive").
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Stop and archive", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();

    await expect(page.getByText("Survey archived", { exact: true })).toBeVisible();
    await expect(page.getByText(surveyName, { exact: true })).toBeHidden();
  });
});
