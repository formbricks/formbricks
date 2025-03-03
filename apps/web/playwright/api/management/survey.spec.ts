import { expect } from "@playwright/test";
import { test } from "../../lib/fixtures";

test.describe("API Tests", () => {
  let surveyId: string;
  let environmentId: string;
  let apiKey: string;

  test("API Tests", async ({ page, users, request }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    await test.step("Copy API Key", async () => {
      environmentId =
        /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
        (() => {
          throw new Error("Unable to parse environmentId from URL");
        })();

      await page.goto(`/environments/${environmentId}/project/api-keys`);

      await page.getByRole("button", { name: "Add Production API Key" }).isVisible();
      await page.getByRole("button", { name: "Add Production API Key" }).click();
      await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill("E2E Test API Key");
      await page.getByRole("button", { name: "Add API Key" }).click();
      await page.locator(".copyApiKeyIcon").click();

      apiKey = await page.evaluate("navigator.clipboard.readText()");
    });

    await test.step("Create Survey from API", async () => {
      const response = await request.post(`/api/v1/management/surveys`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: {
          environmentId: environmentId,
          type: "link",
          name: "My new Survey from API",
          questions: [
            {
              id: "jpvm9b73u06xdrhzi11k2h76",
              type: "openText",
              headline: {
                default: "What would you like to know?",
              },
              required: true,
              inputType: "text",
              subheader: {
                default: "This is an example survey.",
              },
              placeholder: {
                default: "Type your answer here...",
              },
              charLimit: {
                enabled: false,
              },
            },
          ],
        },
      });

      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("My new Survey from API");
      expect(responseBody.data.environmentId).toEqual(environmentId);
    });

    await test.step("List Surveys from API", async () => {
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

    await test.step("Get Survey by ID from API", async () => {
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

    await test.step("Updated Survey by ID from API", async () => {
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

    await test.step("Delete Survey by ID from API", async () => {
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
});
