import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * Integration settings, driven through Slack: remove a channel mapping, then disconnect. The integration
 * is seeded as an OAuth callback would leave it, with credentials Slack won't accept, so the page's
 * channel lookup fails; neither step needs it. Asserted on what the database holds, so it holds before and
 * after the pages moved from server actions onto `/api/internal/integrations` (ENG-3984).
 */
test.describe("Integrations", () => {
  test("removes a Slack channel mapping and disconnects Slack", async ({ page, users }) => {
    const user = await users.create();
    const { workspaceId } = user;
    if (!workspaceId) throw new Error("Workspace not seeded for the test user");
    const survey = await prisma.survey.findFirstOrThrow({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const integration = await prisma.integration.create({
      data: {
        type: "slack",
        workspaceId,
        config: {
          key: {
            app_id: "A0E2E",
            authed_user: { id: "U0E2E" },
            token_type: "bot",
            access_token: "xoxb-e2e-not-a-real-token",
            bot_user_id: "B0E2E",
            team: { id: "T0E2E", name: "E2E" },
          },
          data: [
            {
              createdAt: new Date().toISOString(),
              elementIds: [],
              elements: "All questions",
              surveyId: survey.id,
              surveyName: survey.name,
              channelId: "C0E2E",
              channelName: "e2e-feedback",
            },
          ],
        },
      },
      select: { id: true },
    });
    const stored = () =>
      prisma.integration.findUnique({ where: { id: integration.id }, select: { config: true } });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/workspaces/${workspaceId}/settings/workspace/integrations/slack`, {
      waitUntil: "domcontentloaded",
    });

    await test.step("remove the channel mapping", async () => {
      await page.getByRole("button", { name: /e2e-feedback/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

      await expect(page.getByText("Integration removed successfully")).toBeVisible();
      await expect
        .poll(async () => ((await stored())?.config as { data: unknown[] } | undefined)?.data)
        .toEqual([]);
      // The stored credentials survive a mapping change: the page only ever saw them redacted.
      expect(((await stored())?.config as { key: { access_token: string } }).key.access_token).toBe(
        "xoxb-e2e-not-a-real-token"
      );
    });

    await test.step("disconnect Slack", async () => {
      await page.getByRole("button", { name: "Delete Integration" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

      await expect.poll(stored).toBeNull();
    });
  });
});
