import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch } from "./utils/helper";

/**
 * Follow-ups are deprecated in favour of Workflows. The editor tab now only survives for a survey
 * that already has follow-ups, or on a deployment Workflows cannot reach — so this spec seeds a
 * follow-up rather than creating one from an empty state, which is no longer reachable wherever
 * Workflows are available (CI included, since it boots with an enterprise license).
 *
 * Seeding also makes the journey deterministic: `followUpCount > 0` shows the tab under every
 * licence configuration, so the spec cannot start passing or failing on what the licence server
 * happens to return.
 */
const seedFollowUp = async ({ surveyId, name, to }: { surveyId: string; name: string; to: string }) =>
  prisma.surveyFollowUp.create({
    data: {
      surveyId,
      name,
      trigger: { type: "response", properties: null },
      action: {
        type: "send-email",
        properties: {
          to,
          from: "hola@formbricks.com",
          replyTo: [to],
          subject: "Thanks for responding",
          body: "<p>Thanks!</p>",
          attachResponseData: false,
        },
      },
    },
  });

test.describe("Survey Follow-Up deprecation", async () => {
  // 3 minutes
  test.setTimeout(1000 * 60 * 3);

  test("surfaces the deprecation notice and still edits an existing follow-up", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `follow-up-${timestamp}@example.com`;
    const user = await users.create({ email, name: `follow-up-${timestamp}` });
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyFromScratch(page);

    await test.step("Seed an existing follow-up on the survey", async () => {
      await seedFollowUp({ surveyId, name: "Test Follow-Up", to: email });
      await page.reload();
      await expect(page.getByRole("main").getByText("What would you like to know?").first()).toBeVisible();
    });

    await test.step("Follow-ups tab is still offered and announces the deprecation", async () => {
      await page.getByText("Follow-ups").click();

      await expect(page.getByText("Follow-ups are being replaced by Workflows")).toBeVisible();
      // The date itself, not just the sentence: it is rendered from an instant, so a missing
      // `timeZone` would silently shift it a day west of UTC.
      await expect(page.getByText("Follow-ups stop working on Dec 1, 2026")).toBeVisible();

      // The seeded follow-up is listed with its trigger and action.
      await expect(page.getByText("Test Follow-Up")).toBeVisible();
      await expect(page.getByText("Any response")).toBeVisible();
      await expect(page.getByText("Send email")).toBeVisible();
    });

    await test.step("Edit the existing follow-up and verify it saves", async () => {
      await page.getByText("Test Follow-Up").click();

      await expect(page.getByText("Edit this follow-up")).toBeVisible();

      const nameInput = page.getByPlaceholder("Name your follow-up");
      await nameInput.clear();
      await nameInput.fill("Updated Follow-Up");

      await page.getByRole("button", { name: "Save" }).click();

      const successToast = await page.waitForSelector(".formbricks__toast__success", { timeout: 5000 });
      expect(successToast).toBeTruthy();

      await expect(page.getByText("Updated Follow-Up")).toBeVisible();
    });
  });
});
