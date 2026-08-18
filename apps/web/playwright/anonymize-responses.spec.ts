import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch } from "./utils/helper";

/**
 * The "Anonymize responses" survey toggle (ENG-1842), end to end.
 *
 * Suppression happens at ingest, so the only honest assertion is on what was *stored*: the spec reads
 * the persisted response back through Prisma. The UI assertion that follows is a second, weaker check
 * that the suppressed values do not reappear on the response card.
 *
 * The survey link is opened with `?token=secret` on purpose — that is the shape the feature exists to
 * defend against, an identifier riding in the query string of the page URL.
 */

const QUESTION_HEADLINE = "What would you like to know?";
const ANSWER = "Anonymized answer";

test.describe("Anonymize responses @slow", () => {
  // Publishing plus a real link-survey submission is slow.
  test.setTimeout(1000 * 60 * 5);

  test("suppresses url query, country and device on newly captured responses", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyFromScratch(page);

    await test.step("turn the Anonymize responses toggle on", async () => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();

      // Make it a link survey so the response can be submitted from a plain URL.
      await page.locator("#howToSendCardTrigger").click();
      await expect(page.locator("#howToSendCardOption-link")).toBeVisible();
      await page.locator("#howToSendCardOption-link").click();

      const anonymizeToggle = page.locator("#anonymizeResponses");

      // The Response Options card is a collapsible whose initial open state is derived from the
      // survey type at mount, and a survey created from scratch is already a link survey, so the
      // card starts expanded — clicking its header blindly would COLLAPSE it and unmount the
      // toggle. Open it only when the toggle is not on screen, the same idempotent
      // "click until the content is there" shape the other editor specs use.
      await expect(async () => {
        if (!(await anonymizeToggle.isVisible().catch(() => false))) {
          await page.getByText("Response Options", { exact: true }).click();
        }
        await expect(anonymizeToggle).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: 30000 });

      await expect(anonymizeToggle).not.toBeChecked(); // off by default
      await anonymizeToggle.click();
      await expect(anonymizeToggle).toBeChecked();

      await page.getByRole("button", { name: "Save as draft", exact: true }).click();
      await expect(page.getByText("Changes saved.")).toBeVisible();
    });

    await test.step("the toggle is persisted on the survey", async () => {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: { isAnonymizeResponsesEnabled: true },
      });

      expect(survey?.isAnonymizeResponsesEnabled).toBe(true);
    });

    let surveyUrl: string | null = null;
    let summaryUrl = "";

    await test.step("publish and copy the link", async () => {
      await Promise.all([
        page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/, { timeout: 120000 }),
        page.getByRole("button", { name: "Publish", exact: true }).click(),
      ]);

      // Remembered here because the steps below navigate away to the public survey page: by the
      // time the response card is asserted on, `page.url()` is no longer the summary URL.
      summaryUrl = page.url();

      await page.getByLabel("Copy survey link to clipboard").click();
      surveyUrl = (await page.evaluate("navigator.clipboard.readText()")) as string;
      expect(surveyUrl).toBeTruthy();
    });

    await test.step("submit a response from a link carrying a secret in the query string", async () => {
      await page.goto(`${surveyUrl}?token=secret`);

      await expect(page.getByText(QUESTION_HEADLINE)).toBeVisible();
      await page.getByRole("textbox").first().fill(ANSWER);
      // The submit label is the block's own `buttonLabel` when it has one, and only falls back to
      // "Finish"/"Next" when it does not — a survey created from scratch ships "Next" on its single
      // block, so match either rather than assuming the fallback.
      await page.getByRole("button", { name: /^(Next|Finish)$/ }).click();

      await expect(page.getByText("Thank you!")).toBeVisible({ timeout: 30000 });
    });

    await test.step("the stored response carries no query string, country or device", async () => {
      await expect(async () => {
        const response = await prisma.response.findFirst({
          where: { surveyId },
          select: { meta: true },
        });

        expect(response).not.toBeNull();

        const meta = response?.meta as Record<string, unknown>;

        // The whole point: the `?token=secret` did not survive into storage.
        expect(String(meta.url)).not.toContain("token");
        expect(String(meta.url)).not.toContain("?");

        expect(meta).not.toHaveProperty("country");
        expect(meta).not.toHaveProperty("userAgent");
        expect(meta).not.toHaveProperty("ipAddress");
      }).toPass({ timeout: 30000 });
    });

    await test.step("the response card shows no country and no device", async () => {
      await page.goto(summaryUrl.replace(/\/summary(\?.*)?$/, "/responses"));

      await expect(page.getByText(ANSWER).first()).toBeVisible({ timeout: 30000 });

      await expect(page.getByText(/^Country:/)).toHaveCount(0);
      await expect(page.getByText(/^Device:/)).toHaveCount(0);
      await expect(page.getByText(/^Browser:/)).toHaveCount(0);
    });
  });
});
