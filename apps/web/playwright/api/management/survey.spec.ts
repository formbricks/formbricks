import { finishOnboarding, signUpAndLogin } from "@/playwright/utils/helper";
import { users } from "@/playwright/utils/mock";
import { expect, test } from "@playwright/test";

const { name, email, password } = users.survey[2];

test.describe("API Tests", () => {
  let surveyId: string;
  let environmentId: string;
  let apiKey: string;
  test("Copy API Key for API Calls", async ({ page }) => {
    await signUpAndLogin(page, name, email, password);
    await finishOnboarding(page);

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to parse environmentId from URL");
      })();

    await page.goto(`/environments/${environmentId}/settings/api-keys`);

    await page.getByRole("button", { name: "Add Production API Key" }).isVisible();
    await page.getByRole("button", { name: "Add Production API Key" }).click();
    await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill("E2E Test API Key");
    await page.getByRole("button", { name: "Add API Key" }).click();
    await page.locator("main").filter({ hasText: "Account" }).getByRole("img").nth(1).click();

    apiKey = await page.evaluate("navigator.clipboard.readText()");
  });

  test("Create Survey from API", async ({ request }) => {
    const response = await request.post(`/api/v1/management/surveys`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      data: {
        environmentId: environmentId,
        type: "link",
        name: "My new Survey from API",
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.data.name).toEqual("My new Survey from API");
    expect(responseBody.data.environmentId).toEqual(environmentId);
  });

  test("List Surveys from API", async ({ request }) => {
    const response = await request.get(`/api/v1/management/surveys`, {
      headers: {
        "x-api-key": apiKey,
      },
    });
    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();

    const surveyCount = responseBody.data.length;
    expect(surveyCount).toEqual(1);

    surveyId = responseBody.data[0].id;
  });

  test("Get Survey by ID from API", async ({ request }) => {
    const responseSurvey = await request.get(`/api/v1/management/surveys/${surveyId}`, {
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
    });
    expect(responseSurvey.ok()).toBeTruthy();
    const responseBodySurvey = await responseSurvey.json();

    expect(responseBodySurvey.data.id).toEqual(surveyId);
  });

  test("Updated Survey by ID from API", async ({ request }) => {
    const response = await request.put(`/api/v1/management/surveys/${surveyId}`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      data: {
        name: "My updated Survey from API",
      },
    });

    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.data.name).toEqual("My updated Survey from API");
  });

  test("Delete Survey by ID from API", async ({ request }) => {
    const response = await request.delete(`/api/v1/management/surveys/${surveyId}`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });
    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.data.name).toEqual("My updated Survey from API");

    const responseSurvey = await request.get(`/api/v1/management/surveys/${surveyId}`, {
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
    });
    expect(responseSurvey.ok()).toBeFalsy();
  });
});
