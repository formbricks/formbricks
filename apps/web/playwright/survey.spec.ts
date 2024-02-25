import { surveys, users } from "@/playwright/utils/mock";
import { expect, test } from "@playwright/test";

import { signUpAndLogin } from "./utils/helper";
import { skipOnboarding } from "./utils/helper";
import { createSurvey } from "./utils/helper";

test.describe("Survey Create & Submit Response", async () => {
  test.describe.configure({ mode: "serial" });
  let url: string | null;
  const { name, email, password } = users.survey[0];

  test("Create Survey", async ({ page }) => {
    await createSurvey(page, name, email, password, surveys.createAndSubmit);
    // Save & Publish Survey
    await page.getByRole("button", { name: "Continue to Settings" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    // Get URL
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary$/);
    url = await page
      .locator("div")
      .filter({ hasText: /^http:\/\/localhost:3000\/s\/[A-Za-z0-9]+$/ })
      .innerText();
  });

  test("Create Survey with Custom Actions", async ({ page }) => {
    const { name, email, password } = users.survey[1];

    await createSurvey(page, name, email, password, surveys.createAndSubmit);
    // Save & Publish Survey
    await page.getByRole("button", { name: "Continue to Settings" }).click();

    await expect(page.locator("#howToSendCardTrigger")).toBeVisible();
    await page.locator("#howToSendCardTrigger").click();

    await expect(page.locator("#howToSendCardOption-web")).toBeVisible();
    await page.locator("#howToSendCardOption-web").click();

    await expect(page.getByText("Survey Trigger")).toBeVisible();
    await page.getByText("Survey Trigger").click();

    await page.getByRole("button", { name: "Custom Actions" }).click();

    await expect(page.locator("#codeAction")).toBeVisible();
    await page.locator("#codeAction").click();

    await expect(page.locator("#codeActionIdentifierInput")).toBeVisible();
    await page.locator("#codeActionIdentifierInput").fill("my-custom-code-action");

    await expect(page.locator("#noCodeAction")).toBeVisible();
    await page.locator("#noCodeAction").click();

    await expect(page.locator("#cssSelectorToggle")).toBeVisible();
    await expect(page.locator("#pageURLToggle")).toBeVisible();
    await expect(page.locator("#innerHTMLToggle")).toBeVisible();

    await page.locator("#cssSelectorToggle").click();
    await expect(page.locator("#cssSelectorInput")).toBeVisible();
    await page.locator("#cssSelectorInput").fill(".my-custom-class");

    await page.locator("#pageURLToggle").click();
    await expect(page.locator("#pageURLInput")).toBeVisible();
    await page.locator("#pageURLInput").fill("custom-url");

    await page.locator("#innerHTMLToggle").click();
    await expect(page.locator("#innerHTMLInput")).toBeVisible();
    await page.locator("#innerHTMLInput").fill("Download");

    await page.getByRole("button", { name: "Publish" }).click();
  });

  test("Submit Survey Response", async ({ page }) => {
    await page.goto(url!);
    await page.waitForURL(/\/s\/[A-Za-z0-9]+$/);

    // Welcome Card
    await expect(page.getByText(surveys.createAndSubmit.welcomeCard.headline)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.welcomeCard.description)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Open Text Question
    await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.openTextQuestion.description)).toBeVisible();
    await expect(page.getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)).toBeVisible();
    await page
      .getByPlaceholder(surveys.createAndSubmit.openTextQuestion.placeholder)
      .fill("This is my Open Text answer");
    await page.getByRole("button", { name: "Next" }).click();

    // Single Select Question
    await expect(page.getByText(surveys.createAndSubmit.singleSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.singleSelectQuestion.description)).toBeVisible();
    for (let i = 0; i < surveys.createAndSubmit.singleSelectQuestion.options.length; i++) {
      await expect(page.getByText(surveys.createAndSubmit.singleSelectQuestion.options[i])).toBeVisible();
    }
    await expect(page.getByText("Other")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveys.createAndSubmit.singleSelectQuestion.options[0]).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Multi Select Question
    await expect(page.getByText(surveys.createAndSubmit.multiSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.multiSelectQuestion.description)).toBeVisible();
    for (let i = 0; i < surveys.createAndSubmit.multiSelectQuestion.options.length; i++) {
      await expect(page.getByText(surveys.createAndSubmit.multiSelectQuestion.options[i])).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveys.createAndSubmit.multiSelectQuestion.options[0]).click();
    await page.getByText(surveys.createAndSubmit.multiSelectQuestion.options[1]).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Rating Question
    await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.description)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.lowLabel)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.ratingQuestion.highLabel)).toBeVisible();
    expect(await page.getByRole("group", { name: "Choices" }).locator("label").count()).toBe(5);
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByLabel("").nth(3).click();

    // NPS Question
    await expect(page.getByText(surveys.createAndSubmit.npsQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.npsQuestion.lowLabel)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.npsQuestion.highLabel)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    for (let i = 0; i < 11; i++) {
      await expect(page.getByText(`${i}`, { exact: true })).toBeVisible();
    }
    await page.getByText("8").click();

    // CTA Question
    await expect(page.getByText(surveys.createAndSubmit.ctaQuestion.question)).toBeVisible();
    await expect(
      page.getByRole("button", { name: surveys.createAndSubmit.ctaQuestion.buttonLabel })
    ).toBeVisible();
    await page.getByRole("button", { name: surveys.createAndSubmit.ctaQuestion.buttonLabel }).click();

    // Consent Question
    await expect(page.getByText(surveys.createAndSubmit.consentQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.consentQuestion.checkboxLabel)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByText(surveys.createAndSubmit.consentQuestion.checkboxLabel).check();
    await page.getByRole("button", { name: "Next" }).click();

    // Picture Select Question
    await expect(page.getByText(surveys.createAndSubmit.pictureSelectQuestion.question)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.pictureSelectQuestion.description)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("img", { name: "puppy-1-small.jpg" })).toBeVisible();
    await expect(page.getByRole("img", { name: "puppy-2-small.jpg" })).toBeVisible();
    await page.getByRole("img", { name: "puppy-1-small.jpg" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // File Upload Question
    await expect(page.getByText(surveys.createAndSubmit.fileUploadQuestion.question)).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: "Click or drag to upload files." }).locator("div").nth(0)
    ).toBeVisible();
    await page.locator("input[type=file]").setInputFiles({
      name: "file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is test"),
    });
    await page.getByText("Uploading...").waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "Finish" }).click();

    // Thank You Card
    await expect(page.getByText(surveys.createAndSubmit.thankYouCard.headline)).toBeVisible();
    await expect(page.getByText(surveys.createAndSubmit.thankYouCard.description)).toBeVisible();
  });
});

test.describe("Multi Language Survey Create", async () => {
  test.describe.configure({ mode: "serial" });
  const { name, email, password } = users.survey[1];
  test("Create Survey", async ({ page }) => {
    await signUpAndLogin(page, name, email, password);
    await skipOnboarding(page);

    //add a new language
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Multipe Languages" }).click();
    await page.getByRole("button", { name: "Add Language" }).click();
    await page.getByPlaceholder("e.g., English").nth(1).click();
    await page.getByPlaceholder("e.g., English").nth(1).fill("German");
    await page.getByPlaceholder("e.g., English").nth(1).press("Tab");
    await page.getByPlaceholder("e.g., en").nth(3).fill("de");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("link", { name: "Surveys" }).click();
    await page.getByRole("button", { name: "Start from scratch Create a" }).click();
    await page.locator("#welcome-toggle").click();
    await page.getByText("Welcome CardShownEnabled").click();

    // Add questions in default language
    await page.getByText("Add Question").click();
    await page.getByRole("button", { name: "Single-Select" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Multi-Select" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Picture Selection" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Rating" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Call-to-Action" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Consent" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Date" }).click();
    await page
      .locator("div")
      .filter({ hasText: /^Add QuestionAdd a new question to your survey$/ })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "File Upload" }).click();

    // Enable translation in german
    await page.getByText("Add Translation").click();
    await page.getByRole("button", { name: "Translation Settings" }).click();
    await page.getByLabel("German").click();
    await page.getByText("Welcome CardShownEnabled").click();
    await page.getByRole("button", { name: "English" }).first().click();
    await page.getByRole("button", { name: "German" }).click();

    // Fill welcome card in german
    await page.getByLabel("Headline").click();
    await page.getByLabel("Headline").fill(surveys.germanCreate.welcomeCard.headline);
    await page.locator(".editor-input").click();
    await page.locator(".editor-input").fill(surveys.germanCreate.welcomeCard.description);

    // Fill Open text question in german
    await page.getByRole("button", { name: "Free text Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.openTextQuestion.question);
    await page.getByPlaceholder("Your question here. Recall").press("Tab");
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.openTextQuestion.description);
    await page.getByLabel("Placeholder").click();
    await page.getByLabel("Placeholder").fill(surveys.germanCreate.openTextQuestion.placeholder);

    // Fill Single select question in german
    await page.getByRole("button", { name: "Single-Select Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.singleSelectQuestion.question);
    await page.getByPlaceholder("Your description here. Recall").click();
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.singleSelectQuestion.description);
    await page.getByPlaceholder("Option 1").click();
    await page.getByPlaceholder("Option 1").fill(surveys.germanCreate.singleSelectQuestion.options[0]);
    await page.getByPlaceholder("Option 2").click();
    await page.getByPlaceholder("Option 2").fill(surveys.germanCreate.singleSelectQuestion.options[1]);

    // Fill Multi select question in german
    await page.getByRole("button", { name: "Multi-Select Required" }).click();
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
    await page.getByRole("button", { name: "Picture Selection Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.pictureSelectQuestion.question);
    await page.getByPlaceholder("Your description here. Recall").click();
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.pictureSelectQuestion.description);

    // Fill Rating question in german
    await page.getByRole("button", { name: "Rating Required" }).click();
    await page.getByRole("button", { name: "5 Rating Question Question" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.ratingQuestion.question);
    await page.getByPlaceholder("Your description here. Recall").click();
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.ratingQuestion.description);
    await page.getByPlaceholder("Not good").click();
    await page.getByPlaceholder("Not good").fill(surveys.germanCreate.ratingQuestion.lowLabel);
    await page.getByPlaceholder("Very satisfied").click();
    await page.getByPlaceholder("Very satisfied").fill(surveys.germanCreate.ratingQuestion.highLabel);

    // Fill NPS question in german
    await page.getByRole("button", { name: "Net Promoter Score (NPS) Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page.getByPlaceholder("Your question here. Recall").fill(surveys.germanCreate.npsQuestion.question);
    await page.getByLabel("Lower Label").click();
    await page.getByLabel("Lower Label").fill(surveys.germanCreate.npsQuestion.lowLabel);
    await page.getByLabel("Upper Label").click();
    await page.getByLabel("Upper Label").fill(surveys.germanCreate.npsQuestion.highLabel);

    // Fill CTA question in german
    await page.getByRole("button", { name: "Call-to-Action Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page.getByPlaceholder("Your question here. Recall").fill(surveys.germanCreate.ctaQuestion.question);

    // Fill Consent question in german
    await page.getByRole("button", { name: "Consent Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.ctaQuestion.buttonLabel);
    await page.getByPlaceholder("I agree to the terms and").click();
    await page
      .getByPlaceholder("I agree to the terms and")
      .fill(surveys.germanCreate.ctaQuestion.buttonLabel);

    // Fill Date question in german
    await page.getByRole("button", { name: "Date Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.dateQuestion.question);

    // Fill File upload question in german
    await page.getByRole("button", { name: "File Upload Required" }).click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.fileUploadQuestion.question);

    // Fill Thank you card in german
    await page
      .locator("div")
      .filter({ hasText: /^Thank You CardShown$/ })
      .first()
      .click();
    await page.getByPlaceholder("Your question here. Recall").click();
    await page
      .getByPlaceholder("Your question here. Recall")
      .fill(surveys.germanCreate.thankYouCard.headline);
    await page.getByPlaceholder("Your description here. Recall").click();
    await page
      .getByPlaceholder("Your description here. Recall")
      .fill(surveys.germanCreate.thankYouCard.description);
    await page.getByRole("button", { name: "Continue to Settings" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary$/);
    await page.getByLabel("Select Language").click();
    await page.getByText("German").click();
  });
});
