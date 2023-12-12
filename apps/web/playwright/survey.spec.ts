import { getUser, login, signUpAndLogin, skipOnboarding } from "./utils";
import { test, expect } from "@playwright/test";

test.describe("Survey: Product Market Fit", async () => {
  test.describe.configure({ mode: "serial" });
  let url: string | null;
  const { name, email, password } = getUser();

  test("Create Survey", async ({ page }) => {
    await signUpAndLogin(page, name, email, password);
    await skipOnboarding(page);

    await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).click();
    await page.getByRole("button", { name: "Continue to Settings" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    const regexPattern = /^http:\/\/localhost:3000\/s\//;
    const urlElement = page.locator(`text=${regexPattern}`);

    await expect(urlElement).toBeVisible();
    url = await urlElement.textContent();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("Submit Response: No", async ({ page }) => {
    await page.goto(url!);

    await expect(page.getByText("You are one of our power users! Do you have 5 minutes?")).toBeVisible();
    await expect(page.getByText("Optional")).toBeVisible();

    await page.getByRole("button", { name: "No, thanks." }).click();

    await expect(page.getByText("Thank you!")).toBeVisible();
    await expect(page.getByText("We appreciate your feedback.")).toBeVisible();
  });

  test("Submit Response: Yes", async ({ page }) => {
    await page.goto(url!);

    await expect(page.getByText("You are one of our power users! Do you have 5 minutes?")).toBeVisible();
    await expect(page.getByText("Optional")).toBeVisible();

    await page.getByRole("button", { name: "Happy to help!" }).click();

    await expect(
      page.getByText("How disappointed would you be if you could no longer use My Product?")
    ).toBeVisible();
    let answers = ["Not at all disappointed", "Somewhat disappointed", "Very disappointed"];
    let answer = answers[Math.floor(Math.random() * answers.length)];
    await page.getByText(answer).click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("What is your role?")).toBeVisible();
    answers = ["Founder", "Executive", "Product Manager", "Product Owner", "Software Engineer"];
    answer = answers[Math.floor(Math.random() * answers.length)];
    await page.getByText(answer).click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.getByText("What type of people do you think would most benefit from My Product?")
    ).toBeVisible();
    await page.getByLabel("").fill("Founders and Executives");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("What is the main benefit you")).toBeVisible();
    await page.getByLabel("").fill("Open Source and the UX!");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("How can we improve My Product")).toBeVisible();
    await page.getByLabel("").fill("More and more features, that's it! Keep shipping.");
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.getByText("Thank you!")).toBeVisible();
    await expect(page.getByText("We appreciate your feedback.")).toBeVisible();
  });

  test("View Responses", async ({ page }) => {
    await login(page, email, password);
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText("Your Surveys")).toBeVisible();
    await page.locator("li").filter({ hasText: "Link SurveyProduct Market Fit" }).getByRole("link").click();
    await expect(page.getByText("Responses")).toBeVisible();
    await expect(page.getByText("Product Market Fit (Superhuman)")).toBeVisible();
    await expect(page.getByText("Displays2")).toBeVisible();
    await page.getByRole("button", { name: "Responses100%" }).textContent();
    await page.getByRole("link", { name: "Responses" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/responses/);
    expect(await page.locator(".rounded-b-lg").count()).toEqual(2);

    await expect(
      page.getByText("You are one of our power users! Do you have 5 minutes?dismissed")
    ).toBeVisible();

    await expect(
      page.getByText("You are one of our power users! Do you have 5 minutes?clicked")
    ).toBeVisible();
  });
});
