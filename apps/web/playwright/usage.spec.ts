import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * The organization Usage page end to end: sidebar → page → the internal usage route → counts. The counting
 * rules themselves (range bounds, time zones, member bands) are unit-tested next to the service; this
 * proves the wiring — that an owner reaches the page, that the numbers come back per workspace, and that a
 * range change refetches without a navigation.
 */
test.describe("Organization usage", () => {
  test("an owner sees responses per workspace and the total for the chosen range", async ({
    page,
    users,
  }) => {
    const user = await users.create({ workspaceName: "Europe" });
    const { organizationId, workspaceId } = user;
    if (!workspaceId) {
      throw new Error("Workspace not seeded for the test user");
    }

    const northAmerica = await prisma.workspace.create({ data: { name: "North America", organizationId } });
    const seedResponses = async (surveyWorkspaceId: string, count: number, createdAt: Date) => {
      const survey = await prisma.survey.create({
        data: {
          workspaceId: surveyWorkspaceId,
          createdBy: user.id,
          name: "Usage survey",
          status: "inProgress",
          type: "link",
        },
      });
      await prisma.response.createMany({
        data: Array.from({ length: count }, (_, n) => ({
          surveyId: survey.id,
          // Partial responses count too.
          finished: n % 2 === 0,
          data: {},
          createdAt,
        })),
      });
    };
    const now = new Date();
    const twoYearsAgo = new Date(Date.UTC(now.getUTCFullYear() - 2, 5, 1));
    await seedResponses(workspaceId, 5, now);
    await seedResponses(workspaceId, 2, twoYearsAgo);
    await seedResponses(northAmerica.id, 3, now);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const total = page.getByTestId("usage-total-row");
    const rowFor = (name: string) => page.getByTestId("usage-workspaces-table").getByRole("row", { name });

    await test.step("the Usage tab opens on this year", async () => {
      await page.goto(`/organizations/${organizationId}/settings/general`);
      await page.getByRole("link", { name: "Usage" }).click();
      await expect(page).toHaveURL(new RegExp(`/organizations/${organizationId}/settings/usage`));
      await expect(rowFor("Europe")).toContainText("5");
      await expect(rowFor("North America")).toContainText("3");
      await expect(total).toContainText("8");
    });

    await test.step("all time adds the older responses without leaving the page", async () => {
      await page.getByRole("combobox", { name: "Date range" }).click();
      await page.getByRole("option", { name: "All time" }).click();
      await expect(rowFor("Europe")).toContainText("7");
      await expect(total).toContainText("10");
      await expect(page).toHaveURL(new RegExp(`/organizations/${organizationId}/settings/usage$`));
    });
  });
});
