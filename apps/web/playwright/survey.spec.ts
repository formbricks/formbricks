import { expect } from "@playwright/test";
import { surveys } from "@/playwright/utils/mock";
import { test } from "./lib/fixtures";
import { createSurvey, createSurveyWithLogic } from "./utils/helper";

test.use({
  launchOptions: {
    slowMo: 150,
  },
});

test.describe("Survey Create & Submit Response without logic", async () => {
  // 5 minutes
  test.setTimeout(1000 * 60 * 5);

  let url: string | null;

  test("Create survey and submit response", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    await test.step("Create Survey", async () => {
      await createSurvey(page, surveys.createAndSubmit);

      // Save & Publish Survey
      await page.getByRole("button", { name: "Settings", exact: true }).click();

      await page.locator("#howToSendCardTrigger").click();
      await expect(page.locator("#howToSendCardOption-link")).toBeVisible();
      await page.locator("#howToSendCardOption-link").click();

      // Wait for any auto-save to complete before publishing
      await page.waitForTimeout(2000);

      await page.getByRole("button", { name: "Publish" }).click();

      // Get URL - increase timeout for slower local environments
      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/, { timeout: 60000 });
      await page.getByLabel("Copy survey link to clipboard").click();
      url = await page.evaluate("navigator.clipboard.readText()");
    });

    await test.step("Submit Survey Response", async () => {
      await page.goto(url!);
      await page.waitForURL(/\/s\/[A-Za-z0-9]+$/);

      // Welcome Card
      await expect(
        page.locator("#questionCard--1").getByText(surveys.createAndSubmit.welcomeCard.headline)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard--1").getByText(surveys.createAndSubmit.welcomeCard.description)
      ).toBeVisible();
      await page.locator("#questionCard--1").getByRole("button", { name: "Next" }).click();

      // Open Text Question
      await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.description)).toBeVisible();
      await expect(page.getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)).toBeVisible();
      await page
        .getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)
        .fill("Open Text answer");
      await page.locator("#questionCard-0").getByRole("button", { name: "Next" }).click();

      // Single Select Question
      await expect(page.getByText(surveys.createAndSubmit.singleSelectQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.singleSelectQuestion.description)).toBeVisible();
      for (let i = 0; i < surveys.createAndSubmit.singleSelectQuestion.options.length; i++) {
        await expect(
          page
            .locator("#questionCard-1 label")
            .filter({ hasText: surveys.createAndSubmit.singleSelectQuestion.options[i] })
        ).toBeVisible();
      }
      await expect(page.getByText("Other")).toBeVisible();
      await expect(page.locator("#questionCard-1").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-1").getByRole("button", { name: "Back" })).toBeVisible();
      await page
        .locator("#questionCard-1 label")
        .filter({ hasText: surveys.createAndSubmit.singleSelectQuestion.options[0] })
        .click();
      await page.locator("#questionCard-1").getByRole("button", { name: "Next" }).click();

      // Multi Select Question
      await expect(page.getByText(surveys.createAndSubmit.multiSelectQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.multiSelectQuestion.description)).toBeVisible();
      for (let i = 0; i < surveys.createAndSubmit.singleSelectQuestion.options.length; i++) {
        await expect(
          page
            .locator("#questionCard-2 label")
            .filter({ hasText: surveys.createAndSubmit.multiSelectQuestion.options[i] })
        ).toBeVisible();
      }
      await expect(page.locator("#questionCard-2").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-2").getByRole("button", { name: "Back" })).toBeVisible();
      for (let i = 0; i < surveys.createAndSubmit.multiSelectQuestion.options.length; i++) {
        await page
          .locator("#questionCard-2 label")
          .filter({ hasText: surveys.createAndSubmit.multiSelectQuestion.options[i] })
          .click();
      }
      await page.locator("#questionCard-2").getByRole("button", { name: "Next" }).click();

      // Rating Question
      await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.description)).toBeVisible();
      await expect(
        page.locator("#questionCard-3").getByText(surveys.createAndSubmit.ratingQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-3").getByText(surveys.createAndSubmit.ratingQuestion.highLabel)
      ).toBeVisible();
      // Rating component uses fieldset with labels, not a group with name "Choices"
      expect(await page.locator("#questionCard-3").locator("fieldset label").count()).toBe(5);
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Back" })).toBeVisible();
      // Click on the label instead of the radio to avoid SVG intercepting pointer events
      await page.locator("#questionCard-3").locator('label:has(input[value="3"])').click();
      await page.locator("#questionCard-3").getByRole("button", { name: "Next" }).click();

      // NPS Question
      await expect(page.getByText(surveys.createAndSubmit.npsQuestion.question)).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createAndSubmit.npsQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createAndSubmit.npsQuestion.highLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Back" })).toBeVisible();

      for (let i = 0; i < 11; i++) {
        await expect(page.locator("#questionCard-4").getByText(`${i}`, { exact: true })).toBeVisible();
      }
      await page.locator("#questionCard-4").getByText("8", { exact: true }).click();
      await page.locator("#questionCard-4").getByRole("button", { name: "Next" }).click();

      // CTA Question
      await expect(page.getByText(surveys.createAndSubmit.ctaQuestion.question)).toBeVisible();
      await expect(
        page.getByRole("button", { name: surveys.createAndSubmit.ctaQuestion.buttonLabel })
      ).toBeVisible();
      await page.locator("#questionCard-5").getByRole("button", { name: "Next" }).click();

      // Consent Question
      await expect(page.getByText(surveys.createAndSubmit.consentQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.consentQuestion.checkboxLabel)).toBeVisible();
      await expect(page.locator("#questionCard-6").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-6").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByLabel(surveys.createAndSubmit.consentQuestion.checkboxLabel).check();
      await page.locator("#questionCard-6").getByRole("button", { name: "Next" }).click();

      // Picture Select Question
      await expect(page.getByText(surveys.createAndSubmit.pictureSelectQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.pictureSelectQuestion.description)).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Back" })).toBeVisible();
      await expect(page.getByRole("img", { name: "puppy-1-small.jpg" })).toBeVisible();
      await expect(page.getByRole("img", { name: "puppy-2-small.jpg" })).toBeVisible();
      await page.getByRole("img", { name: "puppy-1-small.jpg" }).click();
      await page.locator("#questionCard-7").getByRole("button", { name: "Next" }).click();

      // File Upload Question
      await expect(page.getByText(surveys.createAndSubmit.fileUploadQuestion.question)).toBeVisible();
      await expect(page.locator("#questionCard-8").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-8").getByRole("button", { name: "Back" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload files by clicking or" })).toBeVisible();

      await page.locator("input[type=file]").setInputFiles({
        name: "file.doc",
        mimeType: "application/msword",
        buffer: Buffer.from("this is test"),
      });

      await page.getByText("Uploading...").waitFor({ state: "hidden" });
      await page.locator("#questionCard-8").getByRole("button", { name: "Next" }).click();

      // Matrix Question
      await expect(page.getByText(surveys.createAndSubmit.matrix.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.matrix.description)).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createAndSubmit.matrix.rows[0] })
      ).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createAndSubmit.matrix.rows[1] })
      ).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createAndSubmit.matrix.rows[2] })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: surveys.createAndSubmit.matrix.columns[0], exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: surveys.createAndSubmit.matrix.columns[1], exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: surveys.createAndSubmit.matrix.columns[2], exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: surveys.createAndSubmit.matrix.columns[3], exact: true })
      ).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByRole("radio", { name: "Roses-0" }).click();
      await page.getByRole("radio", { name: "Trees-0" }).click();
      await page.getByRole("radio", { name: "Ocean-0" }).click();
      await page.locator("#questionCard-9").getByRole("button", { name: "Next" }).click();

      // Address Question
      await expect(page.getByText(surveys.createAndSubmit.address.question)).toBeVisible();
      await expect(page.getByLabel(surveys.createAndSubmit.address.placeholder.addressLine1)).toBeVisible();
      await page.getByLabel(surveys.createAndSubmit.address.placeholder.addressLine1).fill("Address");
      await expect(page.getByLabel(surveys.createAndSubmit.address.placeholder.city)).toBeVisible();
      await page.getByLabel(surveys.createAndSubmit.address.placeholder.city).fill("city");
      await expect(page.getByLabel(surveys.createAndSubmit.address.placeholder.zip)).toBeVisible();
      await page.getByLabel(surveys.createAndSubmit.address.placeholder.zip).fill("12345");
      await page.locator("#questionCard-10").getByRole("button", { name: "Next" }).click();

      // Contact Info Question
      await expect(page.getByText(surveys.createAndSubmit.contactInfo.question)).toBeVisible();
      await expect(page.getByLabel(surveys.createAndSubmit.contactInfo.placeholder)).toBeVisible();
      await page.getByLabel(surveys.createAndSubmit.contactInfo.placeholder).fill("John Doe");
      await page.locator("#questionCard-11").getByRole("button", { name: "Next" }).click();

      // Ranking Question
      await expect(page.getByText(surveys.createAndSubmit.ranking.question)).toBeVisible();
      for (let i = 0; i < surveys.createAndSubmit.ranking.choices.length; i++) {
        await page.getByText(surveys.createAndSubmit.ranking.choices[i]).click();
      }
      await page.locator("#questionCard-12").getByRole("button", { name: "Finish" }).click();
      // loading spinner -> wait for it to disappear
      await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });
    });
  });
});

test.describe("Testing Survey with advanced logic", async () => {
  // 8 minutes
  test.setTimeout(1000 * 60 * 8);
  let url: string | null;

  test("Create survey and submit response", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    await test.step("Create Survey", async () => {
      await createSurveyWithLogic(page, surveys.createWithLogicAndSubmit);

      // Save & Publish Survey
      await page.getByRole("button", { name: "Settings", exact: true }).click();

      await page.locator("#howToSendCardTrigger").click();
      await expect(page.locator("#howToSendCardOption-link")).toBeVisible();
      await page.locator("#howToSendCardOption-link").click();

      await page.getByRole("button", { name: "Publish" }).click();

      // Get URL
      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
      await page.getByLabel("Copy survey link to clipboard").click();
      url = await page.evaluate("navigator.clipboard.readText()");
    });

    await test.step("Submit Survey Response", async () => {
      await page.goto(url!);
      await page.waitForURL(/\/s\/[A-Za-z0-9]+$/);

      // Welcome Card
      await expect(
        page.locator("#questionCard--1").getByText(surveys.createWithLogicAndSubmit.welcomeCard.headline)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard--1").getByText(surveys.createWithLogicAndSubmit.welcomeCard.description)
      ).toBeVisible();
      await page.locator("#questionCard--1").getByRole("button", { name: "Next" }).click();

      // Open Text Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.openTextQuestion.question)).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.openTextQuestion.description)
      ).toBeVisible();
      await expect(
        page.getByPlaceholder(surveys.createWithLogicAndSubmit.openTextQuestion.placeholder)
      ).toBeVisible();
      await page
        .getByPlaceholder(surveys.createWithLogicAndSubmit.openTextQuestion.placeholder)
        .fill("Open Text answer");
      await page.locator("#questionCard-0").getByRole("button", { name: "Next" }).click();

      // Single Select Question
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.singleSelectQuestion.question)
      ).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.singleSelectQuestion.description)
      ).toBeVisible();
      for (let i = 0; i < surveys.createWithLogicAndSubmit.singleSelectQuestion.options.length; i++) {
        await expect(
          page
            .locator("#questionCard-1 label")
            .filter({ hasText: surveys.createWithLogicAndSubmit.singleSelectQuestion.options[i] })
        ).toBeVisible();
      }
      await expect(page.getByText("Other")).toBeVisible();
      await expect(page.locator("#questionCard-1").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-1").getByRole("button", { name: "Back" })).toBeVisible();
      await page
        .locator("#questionCard-1 label")
        .filter({ hasText: surveys.createWithLogicAndSubmit.singleSelectQuestion.options[0] })
        .click();
      await page.locator("#questionCard-1").getByRole("button", { name: "Next" }).click();

      // Multi Select Question
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.multiSelectQuestion.question)
      ).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.multiSelectQuestion.description)
      ).toBeVisible();
      for (let i = 0; i < surveys.createWithLogicAndSubmit.singleSelectQuestion.options.length; i++) {
        await expect(
          page
            .locator("#questionCard-2 label")
            .filter({ hasText: surveys.createWithLogicAndSubmit.multiSelectQuestion.options[i] })
        ).toBeVisible();
      }
      await expect(page.locator("#questionCard-2").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-2").getByRole("button", { name: "Back" })).toBeVisible();
      for (let i = 0; i < surveys.createWithLogicAndSubmit.multiSelectQuestion.options.length; i++) {
        await page
          .locator("#questionCard-2 label")
          .filter({ hasText: surveys.createWithLogicAndSubmit.multiSelectQuestion.options[i] })
          .click();
      }
      await page.locator("#questionCard-2").getByRole("button", { name: "Next" }).click();

      // Picture Select Question
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.pictureSelectQuestion.question)
      ).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.pictureSelectQuestion.description)
      ).toBeVisible();
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Back" })).toBeVisible();
      await expect(page.getByRole("img", { name: "puppy-1-small.jpg" })).toBeVisible();
      await expect(page.getByRole("img", { name: "puppy-2-small.jpg" })).toBeVisible();
      await page.getByRole("img", { name: "puppy-1-small.jpg" }).click();
      await page.locator("#questionCard-3").getByRole("button", { name: "Next" }).click();

      // Rating Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ratingQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ratingQuestion.description)).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createWithLogicAndSubmit.ratingQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createWithLogicAndSubmit.ratingQuestion.highLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Back" })).toBeVisible();
      // Click on the label instead of the radio to avoid SVG intercepting pointer events
      await page.locator("#questionCard-4").locator('label:has(input[value="4"])').click();
      await page.locator("#questionCard-4").getByRole("button", { name: "Next" }).click();

      // NPS Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.npsQuestion.question)).toBeVisible();
      await expect(
        page.locator("#questionCard-5").getByText(surveys.createWithLogicAndSubmit.npsQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-5").getByText(surveys.createWithLogicAndSubmit.npsQuestion.highLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-5").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-5").getByRole("button", { name: "Back" })).toBeVisible();

      for (let i = 0; i < 11; i++) {
        await expect(page.locator("#questionCard-5").getByText(`${i}`, { exact: true })).toBeVisible();
      }
      await page.locator("#questionCard-5").getByText("5", { exact: true }).click();
      await page.locator("#questionCard-5").getByRole("button", { name: "Next" }).click();

      // Ranking Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ranking.question)).toBeVisible();
      await page.locator("#questionCard-6").getByRole("button", { name: "Next" }).click();

      // Matrix Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.matrix.question)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.matrix.description)).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createWithLogicAndSubmit.matrix.rows[0] })
      ).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createWithLogicAndSubmit.matrix.rows[1] })
      ).toBeVisible();
      await expect(
        page.getByRole("rowheader", { name: surveys.createWithLogicAndSubmit.matrix.rows[2] })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", {
          name: surveys.createWithLogicAndSubmit.matrix.columns[0],
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", {
          name: surveys.createWithLogicAndSubmit.matrix.columns[1],
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", {
          name: surveys.createWithLogicAndSubmit.matrix.columns[2],
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", {
          name: surveys.createWithLogicAndSubmit.matrix.columns[3],
          exact: true,
        })
      ).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByRole("radio", { name: "Roses-0" }).click();
      await page.getByRole("radio", { name: "Trees-0" }).click();
      await page.getByRole("radio", { name: "Ocean-0" }).click();
      await page.locator("#questionCard-7").getByRole("button", { name: "Next" }).click();

      // CTA Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ctaQuestion.question)).toBeVisible();
      await expect(
        page.getByRole("button", { name: surveys.createWithLogicAndSubmit.ctaQuestion.buttonLabel })
      ).toBeVisible();
      await page
        .getByRole("button", { name: surveys.createWithLogicAndSubmit.ctaQuestion.buttonLabel })
        .click();
      await page.locator("#questionCard-8").getByRole("button", { name: "Next" }).click();

      // Consent Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.consentQuestion.question)).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.consentQuestion.checkboxLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByLabel(surveys.createWithLogicAndSubmit.consentQuestion.checkboxLabel).check();
      await page.locator("#questionCard-9").getByRole("button", { name: "Next" }).click();

      // File Upload Question
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.fileUploadQuestion.question)
      ).toBeVisible();
      await expect(page.locator("#questionCard-10").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-10").getByRole("button", { name: "Back" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Upload files by clicking or" })).toBeVisible();

      await page.locator("input[type=file]").setInputFiles({
        name: "file.doc",
        mimeType: "application/msword",
        buffer: Buffer.from("this is test"),
      });
      await page.getByText("Uploading...").waitFor({ state: "hidden" });
      await page.locator("#questionCard-10").getByRole("button", { name: "Next" }).click();

      // Date Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.date.question)).toBeVisible();
      // Click the "Today" button in the date picker - matches format like "Today, Tuesday, December 16th,"
      await page.getByRole("button", { name: /^Today,/ }).click();
      // Only click "Scroll to bottom" if visible (it may already be scrolled if today is at month end)
      const scrollToBottomButton = page.getByRole("button", { name: "Scroll to bottom" });
      if (await scrollToBottomButton.isVisible()) {
        await scrollToBottomButton.click();
      }
      await page.locator("#questionCard-11").getByRole("button", { name: "Next", exact: true }).click();

      // Cal Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.cal.question)).toBeVisible();
      await page.locator("#questionCard-12").getByRole("button", { name: "Next" }).click();

      // Address Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.address.question)).toBeVisible();
      await expect(
        page.getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.addressLine1)
      ).toBeVisible();
      await page
        .getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.addressLine1)
        .fill("Address");
      await expect(page.getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.city)).toBeVisible();
      await page.getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.city).fill("city");
      await expect(page.getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.zip)).toBeVisible();
      await page.getByLabel(surveys.createWithLogicAndSubmit.address.placeholder.zip).fill("12345");
      await page.locator("#questionCard-13").getByRole("button", { name: "Finish" }).click();

      // loading spinner -> wait for it to disappear
      await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });

      // Thank You Card
      await expect(page.getByText(surveys.createWithLogicAndSubmit.endingCard.headline)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.endingCard.description)).toBeVisible();
    });

    await test.step("Verify Survey Response", async () => {
      await page.goBack();
      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);

      const currentUrl = page.url();
      const updatedUrl = currentUrl.replace("summary?share=true", "responses");

      await page.goto(updatedUrl);
      const responseTable = page.locator("table#response-table");
      await expect(responseTable).toBeVisible();
      await expect(responseTable.getByRole("columnheader", { name: /^score$/i })).toBeVisible({
        timeout: 15000,
      });

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(5000);

      // Look for any cell containing "32" or a score-related value
      const scoreCell = page.getByRole("cell").filter({ hasText: /^32/ });
      await expect(scoreCell).toBeVisible({
        timeout: 15000,
      });

      // Look for the secret message in the table
      const secretCell = page.getByRole("cell").filter({ hasText: /This is a secret message for e2e tests/ });
      await expect(secretCell).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
