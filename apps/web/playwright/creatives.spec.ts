import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { seedAppSurvey } from "./utils/app-survey";
import {
  type SdkHostPage,
  collectCspViolations,
  expectNoCspViolations,
  serveSdkHostPage,
} from "./utils/sdk-host-page";

/**
 * The Creatives journey (ENG-4007): the only place the server's delivery payload, the SDK's creative
 * renderer, the survey renderer it opens, attribution and counting meet. A feedback button published
 * through API v3 shows on the JS SDK host page, opens its survey, the response records the creative,
 * and the summary counts the Impression and the Click.
 *
 * Counts reach the summary through the real `creative-stats.flush` job, which the app's own BullMQ worker
 * runs every minute (in CI too: the production build inlines NODE_ENV, so `NODE_ENV=test pnpm start`
 * still starts the worker). That wait, up to a minute, is most of this journey's runtime.
 */

const CREATIVE_NAME = "Site feedback tab";
const BUTTON_LABEL = "Share feedback";

test.describe("Creatives", () => {
  let hostPage: SdkHostPage;
  let workspaceId = "";

  test.setTimeout(3 * 60 * 1000);
  test.beforeAll(async () => {
    hostPage = await serveSdkHostPage({
      appUrl: test.info().project.use.baseURL ?? "http://localhost:3000",
      getWorkspaceId: () => workspaceId,
    });
  });

  test.afterAll(async () => {
    await hostPage.close();
  });

  test("a published feedback button opens its survey, attributes the response and is counted", async ({
    page,
    users,
  }) => {
    const cspConsoleMessages = await collectCspViolations(page);
    const seeded = await seedAppSurvey(users);
    workspaceId = seeded.workspaceId;
    await seeded.user.login();

    const creativeId = await test.step("publish a feedback button through API v3", async () => {
      // A survey Destination must be visible to the whole workspace with no visibility change pending;
      // a survey inserted through Prisma is pending until the AuthZed outbox worker projects it.
      await expect
        .poll(
          async () =>
            (
              await prisma.survey.findUniqueOrThrow({
                where: { id: seeded.surveyId },
                select: { visibilityPending: true },
              })
            ).visibilityPending,
          { message: "the seeded survey's visibility was never projected", timeout: 30_000 }
        )
        .toBe(false);

      const response = await page.request.post("/api/v3/creatives", {
        data: {
          workspaceId,
          name: CREATIVE_NAME,
          type: "feedbackButton",
          status: "inProgress",
          content: { label: { "en-US": BUTTON_LABEL }, icon: "messageSquare" },
          destination: { type: "survey", surveyId: seeded.surveyId },
        },
      });
      expect(response.status(), await response.text()).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; displayStatus: string } };
      expect(data.displayStatus).toBe("active");
      return data.id;
    });

    await test.step("the host page shows the button, which opens its survey", async () => {
      await page.goto(hostPage.url);
      await page.getByRole("button", { name: BUTTON_LABEL }).click();

      const survey = page.locator("#formbricks-modal-container");
      await expect(survey.getByText("What would you like to know?")).toBeVisible();
      await survey.getByRole("textbox").fill("Where do I find the changelog?");
      await survey.getByRole("button", { name: "Finish" }).click();
      await expect(survey.getByText("Thanks!")).toBeVisible();

      // The button's styles live in a nonce'd <style> in its shadow root, so the host page's CSP stays
      // satisfied through the button, the survey and its ending.
      await expectNoCspViolations(page, cspConsoleMessages);
    });

    await test.step("the response and its display carry the creative", async () => {
      await expect
        .poll(
          () =>
            prisma.response.findFirst({
              where: { surveyId: seeded.surveyId },
              select: { finished: true, meta: true },
            }),
          { message: "the response was not stored as finished", timeout: 15_000 }
        )
        .toMatchObject({
          finished: true,
          meta: { openedByCreativeId: creativeId, openedByCreativeName: CREATIVE_NAME },
        });

      const display = await prisma.display.findFirstOrThrow({
        where: { surveyId: seeded.surveyId },
        select: { creativeId: true },
      });
      expect(display.creativeId).toBe(creativeId);
    });

    await test.step("the summary counts the Impression and the Click", async () => {
      // Counts reach the stats with the next minutely flush; poll the operation the summary reads.
      await expect
        .poll(
          async () => {
            const response = await page.request.get(`/api/v3/creatives/${creativeId}/stats`);
            const { data } = (await response.json()) as {
              data?: { totals: { impressions: number; clicks: number } };
            };
            return data?.totals;
          },
          {
            message: "the Impression and the Click never reached the stats",
            intervals: [2_000],
            timeout: 90_000,
          }
        )
        .toMatchObject({ impressions: 1, clicks: 1 });

      await page.goto(`/workspaces/${workspaceId}/creatives/${creativeId}/summary`);
      await expect(page.getByRole("button", { name: "Impressions" })).toHaveText(/^Impressions\s*1$/);
      await expect(page.getByRole("button", { name: "Clicks" })).toHaveText(/^Clicks\s*1$/);
      await expect(page.getByRole("button", { name: "Click rate" })).toHaveText(/^Click rate\s*100(\.0)?%$/);
    });
  });
});
