import { surveys } from "@/playwright/utils/mock";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { createSurvey, createSurveyWithLogic } from "./utils/helper";

test.use({
  launchOptions: {
    slowMo: 110,
  },
});

test.describe("Survey Create & Submit Response without logic", async () => {
  let url: string | null;

  test.slow();

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
      await expect(page.getByText(surveys.createAndSubmit.welcomeCard.headline)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.welcomeCard.description)).toBeVisible();
      await page.locator("#questionCard--1").getByRole("button", { name: "Next" }).click();

      // Open Text Question
      await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.description)).toBeVisible();
      await expect(page.getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)).toBeVisible();
      await page
        .getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)
        .fill("This is my Open Text answer");
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
      expect(await page.getByRole("group", { name: "Choices" }).locator("label").count()).toBe(5);
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Next" })).not.toBeVisible();
      await expect(page.locator("#questionCard-3").getByRole("button", { name: "Back" })).toBeVisible();
      await page.locator("path").nth(3).click();

      // NPS Question
      await expect(page.getByText(surveys.createAndSubmit.npsQuestion.question)).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createAndSubmit.npsQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-4").getByText(surveys.createAndSubmit.npsQuestion.highLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Next" })).not.toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Back" })).toBeVisible();

      for (let i = 0; i < 11; i++) {
        await expect(page.locator("#questionCard-4").getByText(`${i}`, { exact: true })).toBeVisible();
      }
      await page.locator("#questionCard-4").getByText("8", { exact: true }).click();

      // CTA Question
      await expect(page.getByText(surveys.createAndSubmit.ctaQuestion.question)).toBeVisible();
      await expect(
        page.getByRole("button", { name: surveys.createAndSubmit.ctaQuestion.buttonLabel })
      ).toBeVisible();
      await page.getByRole("button", { name: surveys.createAndSubmit.ctaQuestion.buttonLabel }).click();

      // Consent Question
      await expect(page.getByText(surveys.createAndSubmit.consentQuestion.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.consentQuestion.checkboxLabel)).toBeVisible();
      await expect(page.locator("#questionCard-6").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-6").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByText(surveys.createAndSubmit.consentQuestion.checkboxLabel).check();
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
      await expect(
        page.locator("label").filter({ hasText: "Click or drag to upload files." }).locator("div").nth(0)
      ).toBeVisible();
      await page.locator("input[type=file]").setInputFiles({
        name: "file.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is test"),
      });
      await page.getByText("Uploading...").waitFor({ state: "hidden" });
      await page.locator("#questionCard-8").getByRole("button", { name: "Next" }).click();

      // Matrix Question
      await expect(page.getByText(surveys.createAndSubmit.matrix.question)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.matrix.description)).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.rows[0] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.rows[1] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.rows[2] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.columns[0] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.columns[1] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.columns[2] })).toBeVisible();
      await expect(page.getByRole("cell", { name: surveys.createAndSubmit.matrix.columns[3] })).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByRole("row", { name: "Roses" }).getByRole("cell").nth(1).click();
      await page.getByRole("row", { name: "Trees" }).getByRole("cell").nth(1).click();
      await page.getByRole("row", { name: "Ocean" }).getByRole("cell").nth(1).click();
      await page.locator("#questionCard-9").getByRole("button", { name: "Next" }).click();

      // Address Question
      await expect(page.getByText(surveys.createAndSubmit.address.question)).toBeVisible();
      await expect(page.getByPlaceholder(surveys.createAndSubmit.address.placeholder)).toBeVisible();
      await page.getByPlaceholder(surveys.createAndSubmit.address.placeholder).fill("This is my Address");
      await page.locator("#questionCard-10").getByRole("button", { name: "Next" }).click();

      // Contact Info Question
      await expect(page.getByText(surveys.createAndSubmit.contactInfo.question)).toBeVisible();
      await expect(page.getByPlaceholder(surveys.createAndSubmit.contactInfo.placeholder)).toBeVisible();
      await page.getByPlaceholder(surveys.createAndSubmit.contactInfo.placeholder).fill("John Doe");
      await page.locator("#questionCard-11").getByRole("button", { name: "Next" }).click();

      // Ranking Question
      await expect(page.getByText(surveys.createAndSubmit.ranking.question)).toBeVisible();
      for (let i = 0; i < surveys.createAndSubmit.ranking.choices.length; i++) {
        await page.getByText(surveys.createAndSubmit.ranking.choices[i]).click();
      }
      await page.getByRole("button", { name: "Finish" }).click();
      // loading spinner -> wait for it to disappear
      await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });

      // Thank You Card
      await expect(page.getByText(surveys.createAndSubmit.thankYouCard.headline)).toBeVisible();
      await expect(page.getByText(surveys.createAndSubmit.thankYouCard.description)).toBeVisible();
    });
  });
});

test.describe("Multi Language Survey Create", async () => {
  test("Create Survey", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    //add a new language
    await page.getByRole("link", { name: "Configuration" }).click();
    await page.getByRole("link", { name: "Survey Languages" }).click();
    await page.getByRole("button", { name: "Edit languages" }).click();
    await page.getByRole("button", { name: "Add language" }).click();
    await page.getByRole("button", { name: "Select" }).click();
    await page.getByPlaceholder("Search items").click();
    await page.getByPlaceholder("Search items").fill("Eng");
    await page.getByText("English").click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("button", { name: "Edit languages" }).click();
    await page.getByRole("button", { name: "Add language" }).click();
    await page.getByRole("button", { name: "Select" }).click();
    await page.getByRole("textbox", { name: "Search items" }).click();
    await page.getByRole("textbox", { name: "Search items" }).fill("German");
    await page.getByText("German").nth(1).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForTimeout(2000);
    await page.getByRole("link", { name: "Surveys" }).click();
    await page.getByRole("button", { name: "Start from scratch Create a" }).click();
    await page.getByRole("button", { name: "Create survey", exact: true }).click();
    await page.locator("#multi-lang-toggle").click();
    await page.getByRole("combobox").click();
    await page.getByLabel("English (en)").click();
    await page.getByRole("button", { name: "Set English as default" }).click();
    await page.getByLabel("German").click();
    await page.locator("#welcome-toggle").click();
    await page.getByText("Welcome CardShownOn").click();

    // Add questions in default language
    await page.getByText("Add question").click();
    await page.getByRole("button", { name: "Single-Select" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Multi-Select" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Picture Selection" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Rating" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Date" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "File Upload" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();

    await page.getByRole("button", { name: "Matrix" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Matrix" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Address" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add questionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Ranking" }).click();

    // Enable translation in german
    await page.getByText("Welcome CardShownOn").click();
    await page.getByRole("button", { name: "English" }).nth(1).click();
    await page.getByRole("button", { name: "German" }).click();

    // Fill welcome card in german
    await page.locator(".editor-input").click();
    await page.locator(".editor-input").fill(surveys.germanCreate.welcomeCard.description);
    await page.getByLabel("Note*").click();
    await page.getByLabel("Note*").fill(surveys.germanCreate.welcomeCard.headline);

    // Fill Open text question in german
    await page.getByRole("main").getByText("Free text").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.openTextQuestion.question);
    await page.getByLabel("Placeholder").click();
    await page.getByLabel("Placeholder").fill(surveys.germanCreate.openTextQuestion.placeholder);

    // Fill Single select question in german
    await page.getByRole("main").getByText("Single-Select").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.singleSelectQuestion.question);
    await page.getByPlaceholder("Option 1").click();
    await page.getByPlaceholder("Option 1").fill(surveys.germanCreate.singleSelectQuestion.options[0]);
    await page.getByPlaceholder("Option 2").click();
    await page.getByPlaceholder("Option 2").fill(surveys.germanCreate.singleSelectQuestion.options[1]);

    // Fill Multi select question in german
    await page.getByRole("main").getByText("Multi-Select").click();

    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.multiSelectQuestion.question);
    await page.getByPlaceholder("Option 1").click();
    await page.getByPlaceholder("Option 1").fill(surveys.germanCreate.multiSelectQuestion.options[0]);
    await page.getByPlaceholder("Option 2").click();
    await page.getByPlaceholder("Option 2").fill(surveys.germanCreate.multiSelectQuestion.options[1]);
    await page.getByPlaceholder("Option 3").click();
    await page.getByPlaceholder("Option 3").fill(surveys.germanCreate.multiSelectQuestion.options[2]);

    // Fill Picture select question in german
    await page.getByRole("main").getByText("Picture Selection").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.pictureSelectQuestion.question);

    // Fill Rating question in german
    await page.getByRole("main").getByText("Rating").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.ratingQuestion.question);
    await page.getByPlaceholder("Not good").click();
    await page.getByPlaceholder("Not good").fill(surveys.germanCreate.ratingQuestion.lowLabel);
    await page.getByPlaceholder("Very satisfied").click();
    await page.getByPlaceholder("Very satisfied").fill(surveys.germanCreate.ratingQuestion.highLabel);

    // Fill NPS question in german
    await page.getByRole("main").getByText("Net Promoter Score (NPS)").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page.getByPlaceholder("Your question here. Recall").fill(surveys.germanCreate.npsQuestion.question);
    await page.getByLabel("Lower Label").click();
    await page.getByLabel("Lower Label").fill(surveys.germanCreate.npsQuestion.lowLabel);
    await page.getByLabel("Upper Label").click();
    await page.getByLabel("Upper Label").fill(surveys.germanCreate.npsQuestion.highLabel);

    // Fill Date question in german
    await page.getByRole("main").getByText("Date").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.dateQuestion.question);

    // Fill File upload question in german
    await page.getByRole("main").getByText("File Upload").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.fileUploadQuestion.question);

    // Fill Matrix question in german
    await page.getByRole("main").getByText("Matrix").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page.getByPlaceholder("Your question here. Recall").fill(surveys.germanCreate.matrix.question);
    await page.locator("#row-0").click();
    await page.locator("#row-0").fill(surveys.germanCreate.matrix.rows[0]);
    await page.locator("#row-1").click();
    await page.locator("#row-1").fill(surveys.germanCreate.matrix.rows[1]);
    await page.locator("#row-2").click();
    await page.locator("#row-2").fill(surveys.germanCreate.matrix.rows[2]);
    await page.locator("#column-0").click();
    await page.locator("#column-0").fill(surveys.germanCreate.matrix.columns[0]);
    await page.locator("#column-1").click();
    await page.locator("#column-1").fill(surveys.germanCreate.matrix.columns[1]);
    await page.locator("#column-2").click();
    await page.locator("#column-2").fill(surveys.germanCreate.matrix.columns[2]);
    await page.locator("#column-3").click();
    await page.locator("#column-3").fill(surveys.germanCreate.matrix.columns[3]);

    // Fill Address question in german
    await page.getByRole("main").getByText("Address").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.addressQuestion.question);

    // Fill Ranking question in german
    await page.getByRole("main").getByText("Ranking").click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page.getByPlaceholder("Your question here. Recall").fill(surveys.germanCreate.ranking.question);
    await page.getByPlaceholder("Option 1").click();
    await page.getByPlaceholder("Option 1").fill(surveys.germanCreate.ranking.choices[0]);
    await page.getByPlaceholder("Option 2").click();
    await page.getByPlaceholder("Option 2").fill(surveys.germanCreate.ranking.choices[1]);
    await page.getByPlaceholder("Option 3").click();
    await page.getByPlaceholder("Option 3").fill(surveys.germanCreate.ranking.choices[2]);
    await page.getByPlaceholder("Option 4").click();
    await page.getByPlaceholder("Option 4").fill(surveys.germanCreate.ranking.choices[3]);
    await page.getByPlaceholder("Option 5").click();
    await page.getByPlaceholder("Option 5").fill(surveys.germanCreate.ranking.choices[4]);

    // Fill Thank you card in german
    await page.getByText("Ending card").first().click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.thankYouCard.headline);
    await page.getByPlaceholder("Your description here. Recall").click();
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.thankYouCard.description);

    await page.locator("#showButton").check();

    await page.getByPlaceholder("Create your own Survey").click();
    await page.getByPlaceholder("Create your own Survey").fill(surveys.germanCreate.thankYouCard.buttonLabel);

    // TODO: @pandeymangg - figure out if this is required
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await page.locator("#howToSendCardTrigger").click();
    await expect(page.locator("#howToSendCardOption-link")).toBeVisible();
    await page.locator("#howToSendCardOption-link").click();

    await page.getByRole("button", { name: "Publish" }).click();

    // await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary$/);
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await page.getByLabel("Select Language").click();
    await page.getByText("German").click();
    await page.getByLabel("Copy survey link to clipboard").click();
    const germanSurveyUrl = await page.evaluate("navigator.clipboard.readText()");
    expect(germanSurveyUrl).toContain("lang=de");
  });
});

test.describe("Testing Survey with advanced logic", async () => {
  test.setTimeout(180000);
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
      await expect(page.getByText(surveys.createWithLogicAndSubmit.welcomeCard.headline)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.welcomeCard.description)).toBeVisible();
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
        .fill("This is my Open Text answer");
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
      expect(await page.getByRole("group", { name: "Choices" }).locator("label").count()).toBe(5);
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Next" })).not.toBeVisible();
      await expect(page.locator("#questionCard-4").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByRole("group", { name: "Choices" }).locator("path").nth(3).click();

      // NPS Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.npsQuestion.question)).toBeVisible();
      await expect(
        page.locator("#questionCard-5").getByText(surveys.createWithLogicAndSubmit.npsQuestion.lowLabel)
      ).toBeVisible();
      await expect(
        page.locator("#questionCard-5").getByText(surveys.createWithLogicAndSubmit.npsQuestion.highLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-5").getByRole("button", { name: "Next" })).not.toBeVisible();
      await expect(page.locator("#questionCard-5").getByRole("button", { name: "Back" })).toBeVisible();

      for (let i = 0; i < 11; i++) {
        await expect(page.locator("#questionCard-5").getByText(`${i}`, { exact: true })).toBeVisible();
      }
      await page.locator("#questionCard-5").getByText("5", { exact: true }).click();

      // Ranking Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ranking.question)).toBeVisible();
      await page.locator("#questionCard-6").getByRole("button", { name: "Next" }).click();

      // Matrix Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.matrix.question)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.matrix.description)).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.rows[0] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.rows[1] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.rows[2] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.columns[0] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.columns[1] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.columns[2] })
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: surveys.createWithLogicAndSubmit.matrix.columns[3] })
      ).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-7").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByRole("row", { name: "Roses" }).getByRole("cell").nth(1).click();
      await page.getByRole("row", { name: "Trees" }).getByRole("cell").nth(1).click();
      await page.getByRole("row", { name: "Ocean" }).getByRole("cell").nth(1).click();
      await page.locator("#questionCard-7").getByRole("button", { name: "Next" }).click();

      // CTA Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.ctaQuestion.question)).toBeVisible();
      await expect(
        page.getByRole("button", { name: surveys.createWithLogicAndSubmit.ctaQuestion.buttonLabel })
      ).toBeVisible();
      await page
        .getByRole("button", { name: surveys.createWithLogicAndSubmit.ctaQuestion.buttonLabel })
        .click();

      // Consent Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.consentQuestion.question)).toBeVisible();
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.consentQuestion.checkboxLabel)
      ).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-9").getByRole("button", { name: "Back" })).toBeVisible();
      await page.getByText(surveys.createWithLogicAndSubmit.consentQuestion.checkboxLabel).check();
      await page.locator("#questionCard-9").getByRole("button", { name: "Next" }).click();

      // File Upload Question
      await expect(
        page.getByText(surveys.createWithLogicAndSubmit.fileUploadQuestion.question)
      ).toBeVisible();
      await expect(page.locator("#questionCard-10").getByRole("button", { name: "Next" })).toBeVisible();
      await expect(page.locator("#questionCard-10").getByRole("button", { name: "Back" })).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: "Click or drag to upload files." }).locator("div").nth(0)
      ).toBeVisible();
      await page.locator("input[type=file]").setInputFiles({
        name: "file.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is test"),
      });
      await page.getByText("Uploading...").waitFor({ state: "hidden" });
      await page.locator("#questionCard-10").getByRole("button", { name: "Next" }).click();

      // Date Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.date.question)).toBeVisible();
      await page.getByText("Select a date").click();
      const date = new Date().getDate();
      const month = new Date().toLocaleString("default", { month: "long" });
      await page.getByRole("button", { name: `${month} ${date},` }).click();
      await page.locator("#questionCard-11").getByRole("button", { name: "Next" }).click();

      // Cal Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.cal.question)).toBeVisible();
      await page.locator("#questionCard-12").getByRole("button", { name: "Next" }).click();

      // Address Question
      await expect(page.getByText(surveys.createWithLogicAndSubmit.address.question)).toBeVisible();
      await expect(page.getByPlaceholder(surveys.createWithLogicAndSubmit.address.placeholder)).toBeVisible();
      await page
        .getByPlaceholder(surveys.createWithLogicAndSubmit.address.placeholder)
        .fill("This is my Address");
      await page.getByRole("button", { name: "Finish" }).click();

      // loading spinner -> wait for it to disappear
      await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });

      // Thank You Card
      await expect(page.getByText(surveys.createWithLogicAndSubmit.thankYouCard.headline)).toBeVisible();
      await expect(page.getByText(surveys.createWithLogicAndSubmit.thankYouCard.description)).toBeVisible();
    });

    await test.step("Verify Survey Response", async () => {
      await page.goBack();
      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(5000);

      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("link").filter({ hasText: "Responses" }).click();
      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.getByRole("cell", { name: "score" })).toBeVisible();
      await page.waitForTimeout(5000);
      await expect(page.getByRole("cell", { name: "32", exact: true })).toBeVisible();
    });
  });
});
