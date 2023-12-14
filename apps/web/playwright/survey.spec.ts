import { getUser, signUpAndLogin, skipOnboarding, surveyData } from "./utils";
import { test, expect } from "@playwright/test";

test.describe("Survey Create & Submit Response", async () => {
  test.describe.configure({ mode: "serial" });
  let url: string | null;
  const { name, email, password } = getUser();
  let addQuestion = "Add QuestionAdd a new question to your survey";

  test("Create Survey", async ({ page }) => {
    await signUpAndLogin(page, name, email, password);
    await skipOnboarding(page);

    await page.getByRole("heading", { name: "Start from Scratch" }).click();

    // Welcome Card
    await expect(page.locator("#welcome-toggle")).toBeVisible();
    await page.getByText("Welcome Card").click();
    await page.locator("#welcome-toggle").check();
    await page.getByLabel("Headline").fill(surveyData.welcomeCard.headline);
    await page
      .locator("form")
      .getByText("Thanks for providing your")
      .fill(surveyData.welcomeCard.description);
    await page.getByText("Welcome CardEnabled").click();

    // Open Text Question
    await page.getByRole("button", { name: "1 What would you like to know" }).click();
    await page.getByLabel("Question").fill(surveyData.openTextQuestion.question);
    await page.getByLabel("Description").fill(surveyData.openTextQuestion.description);
    await page.getByLabel("Placeholder").fill(surveyData.openTextQuestion.placeholder);
    await page.getByRole("button", { name: surveyData.openTextQuestion.question }).click();

    // Single Select Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Single-Select" }).click();
    await page.getByLabel("Question").fill(surveyData.singleSelectQuestion.question);
    await page.getByLabel("Description").fill(surveyData.singleSelectQuestion.description);
    await page.getByPlaceholder("Option 1").fill(surveyData.singleSelectQuestion.options[0]);
    await page.getByPlaceholder("Option 2").fill(surveyData.singleSelectQuestion.options[1]);
    await page.getByRole("button", { name: 'Add "Other"', exact: true }).click();

    // Multi Select Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Multi-Select" }).click();
    await page.getByLabel("Question").fill(surveyData.multiSelectQuestion.question);
    await page.getByRole("button", { name: "Add Description", exact: true }).click();
    await page.getByLabel("Description").fill(surveyData.multiSelectQuestion.description);
    await page.getByPlaceholder("Option 1").fill(surveyData.multiSelectQuestion.options[0]);
    await page.getByPlaceholder("Option 2").fill(surveyData.multiSelectQuestion.options[1]);
    await page.getByPlaceholder("Option 3").fill(surveyData.multiSelectQuestion.options[2]);

    // Rating Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Rating" }).click();
    await page.getByLabel("Question").fill(surveyData.ratingQuestion.question);
    await page.getByLabel("Scale").fill(surveyData.ratingQuestion.description);
    await page.getByPlaceholder("Not good").fill(surveyData.ratingQuestion.lowLabel);
    await page.getByPlaceholder("Very satisfied").fill(surveyData.ratingQuestion.highLabel);

    // NPS Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
    await page.getByLabel("Question").fill(surveyData.npsQuestion.question);
    await page.getByLabel("Lower label").fill(surveyData.npsQuestion.lowLabel);
    await page
      .locator("div")
      .filter({ hasText: /^Upper label$/ })
      .locator("#subheader")
      .fill(surveyData.npsQuestion.highLabel);

    // CTA Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Call-to-Action" }).click();
    await page.getByLabel("Question").fill(surveyData.ctaQuestion.question);
    await page.getByPlaceholder("Finish").fill(surveyData.ctaQuestion.buttonLabel);

    // Consent Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Consent" }).click();
    await page.getByLabel("Question").fill(surveyData.consentQuestion.question);
    await page.getByPlaceholder("I agree to the terms and").fill(surveyData.consentQuestion.checkboxLabel);

    // Picture Select Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Picture Selection" }).click();
    await page.getByLabel("Question").fill(surveyData.pictureSelectQuestion.question);
    await page.getByLabel("Description").fill(surveyData.pictureSelectQuestion.description);

    // File Upload Question
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addQuestion}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "File Upload" }).click();
    await page.getByLabel("Question").fill(surveyData.fileUploadQuestion.question);

    // Thank You Card
    await page
      .locator("div")
      .filter({ hasText: /^Thank You CardShown$/ })
      .nth(1)
      .click();
    await page.getByLabel("Headline").fill(surveyData.thankYouCard.headline);
    await page.getByLabel("Description").fill(surveyData.thankYouCard.description);

    // Save & Publish Survey
    await page.getByRole("button", { name: "Continue to Settings" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    // Get URL
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary$/);
    url = await page
      .locator("div")
      .filter({ hasText: /^http:\/\/localhost:3000\/s\/[A-Za-z0-9]+$/ })
      .innerText();
    console.log(url);
  });

  test("Submit Survey Response", async ({ page }) => {
    await page.goto(url!);
    await page.waitForURL(/\/s\/[A-Za-z0-9]+$/);

    // Welcome Card
    await expect(page.getByText(surveyData.welcomeCard.headline)).toBeVisible();
    await expect(page.getByText(surveyData.welcomeCard.description)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Open Text Question
    await expect(page.getByText(surveyData.openTextQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.openTextQuestion.description)).toBeVisible();
    await expect(page.getByPlaceholder(surveyData.openTextQuestion.placeholder)).toBeVisible();
    await page.getByPlaceholder(surveyData.openTextQuestion.placeholder).fill("This is my Open Text answer");
    await page.getByRole("button", { name: "Next" }).click();

    // Single Select Question
    await expect(page.getByText(surveyData.singleSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.singleSelectQuestion.description)).toBeVisible();
    await expect(page.getByText(surveyData.singleSelectQuestion.options[0])).toBeVisible();
    await expect(page.getByText(surveyData.singleSelectQuestion.options[1])).toBeVisible();
    await expect(page.getByText("Other")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveyData.singleSelectQuestion.options[0]).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Multi Select Question
    await expect(page.getByText(surveyData.multiSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.multiSelectQuestion.description)).toBeVisible();
    await expect(page.getByText(surveyData.multiSelectQuestion.options[0])).toBeVisible();
    await expect(page.getByText(surveyData.multiSelectQuestion.options[1])).toBeVisible();
    await expect(page.getByText(surveyData.multiSelectQuestion.options[2])).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveyData.multiSelectQuestion.options[0]).click();
    await page.getByText(surveyData.multiSelectQuestion.options[1]).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Rating Question
    await expect(page.getByText(surveyData.ratingQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.ratingQuestion.description)).toBeVisible();
    await expect(page.getByText(surveyData.ratingQuestion.lowLabel)).toBeVisible();
    await expect(page.getByText(surveyData.ratingQuestion.highLabel)).toBeVisible();
    expect(await page.getByRole("group", { name: "Choices" }).locator("label").count()).toBe(5);
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByLabel("").nth(3).click();

    // NPS Question
    await expect(page.getByText(surveyData.npsQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.npsQuestion.lowLabel)).toBeVisible();
    await expect(page.getByText(surveyData.npsQuestion.highLabel)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByText("0", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("4", { exact: true })).toBeVisible();
    await expect(page.getByText("5", { exact: true })).toBeVisible();
    await expect(page.getByText("6", { exact: true })).toBeVisible();
    await expect(page.getByText("7", { exact: true })).toBeVisible();
    await expect(page.getByText("8", { exact: true })).toBeVisible();
    await expect(page.getByText("9", { exact: true })).toBeVisible();
    await expect(page.getByText("10", { exact: true })).toBeVisible();
    await page.getByText("8").click();

    // CTA Question
    await expect(page.getByText(surveyData.ctaQuestion.question)).toBeVisible();
    await expect(page.getByRole("button", { name: surveyData.ctaQuestion.buttonLabel })).toBeVisible();
    await page.getByRole("button", { name: surveyData.ctaQuestion.buttonLabel }).click();

    // Consent Question
    await expect(page.getByText(surveyData.consentQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.consentQuestion.checkboxLabel)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveyData.consentQuestion.checkboxLabel).check();
    await page.getByRole("button", { name: "Next" }).click();

    // Picture Select Question
    await expect(page.getByText(surveyData.pictureSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveyData.pictureSelectQuestion.description)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("img", { name: "puppy-1-small.jpg" })).toBeVisible();
    await expect(page.getByRole("img", { name: "puppy-2-small.jpg" })).toBeVisible();
    await page.getByRole("img", { name: "puppy-1-small.jpg" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // File Upload Question
    await expect(page.getByText(surveyData.fileUploadQuestion.question)).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: "Click or drag to upload files." }).locator("div").nth(0)
    ).toBeVisible();
    await page.locator("input[type=file]").setInputFiles({
      name: "file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is my Input File Text"),
    });
    await page.getByRole("button", { name: "Finish" }).click();

    // Thank You Card
    await expect(page.getByText(surveyData.thankYouCard.headline)).toBeVisible();
    await expect(page.getByText(surveyData.thankYouCard.description)).toBeVisible();
  });
});
