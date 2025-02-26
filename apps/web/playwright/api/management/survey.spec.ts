import { expect } from "@playwright/test";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";
import { SURVEYS_API_URL } from "../constants";

test.describe("API Tests", () => {
  let surveyId, environmentId, apiKey;

  test("API Tests", async ({ page, users, request }) => {
    try {
      ({ environmentId, apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      console.error("Error during login and getting API key:", error);
      throw error;
    }

    await test.step("Create Survey from API", async () => {
      const response = await request.post(SURVEYS_API_URL, {
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

      surveyId = responseBody.data.id;
    });

    await test.step("List Surveys from API", async () => {
      const response = await request.get(SURVEYS_API_URL, {
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
      const responseSurvey = await request.get(`${SURVEYS_API_URL}/${surveyId}`, {
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
      const response = await request.put(`${SURVEYS_API_URL}/${surveyId}`, {
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
      const response = await request.delete(`${SURVEYS_API_URL}/${surveyId}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("My updated Survey from API");

      const responseSurvey = await request.get(`${SURVEYS_API_URL}/${surveyId}`, {
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
      });
      expect(responseSurvey.ok()).toBeFalsy();
    });
  });
});
