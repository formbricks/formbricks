import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";
import { RESPONSES_API_URL, SURVEYS_API_URL } from "../constants";

test.describe("API Tests for Responses", () => {
  test("Create, Retrieve, Update, and Delete Responses via API", async ({ page, users, request }) => {
    let environmentId, apiKey;

    try {
      ({ environmentId, apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error("Error during login and getting API key:", error);
      throw error;
    }

    let createdResponseId1, createdResponseId2, surveyId: string;

    await test.step("Create Survey via API", async () => {
      const surveyBody = {
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
      };

      const response = await request.post(SURVEYS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: surveyBody,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("My new Survey from API");
      surveyId = responseBody.data.id;
    });

    await test.step("Create First Response via API", async () => {
      const responseBody = {
        createdAt: "2021-01-01T00:00:00.000Z",
        updatedAt: "2021-01-01T00:00:00.000Z",
        surveyId: surveyId,
        finished: true,
        language: "en",
        data: {
          question1: "answer1",
          question2: 2,
          question3: ["answer3", "answer4"],
          question4: { subquestion1: "answer5" },
        },
        variables: {
          variable1: "answer1",
          variable2: 2,
        },
        ttc: {
          question1: 10,
          question2: 20,
        },
        meta: {
          source: "https://example.com",
          url: "https://example.com",
          userAgent: {
            browser: "Chrome",
            os: "Windows",
            device: "Desktop",
          },
          country: "US",
          action: "click",
        },
      };

      const response = await request.post(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: responseBody,
      });

      expect(response.ok()).toBe(true);
      const responseJson = await response.json();
      expect(responseJson.data).toHaveProperty("id");
      createdResponseId1 = responseJson.data.id;
    });

    await test.step("Create Second Response via API", async () => {
      const responseBody = {
        createdAt: "2021-01-02T00:00:00.000Z",
        updatedAt: "2021-01-02T00:00:00.000Z",
        surveyId: surveyId,
        finished: true,
        language: "en",
        data: {
          question1: "answer2",
          question2: 3,
          question3: ["answer5", "answer6"],
          question4: { subquestion1: "answer7" },
        },
        variables: {
          variable1: "answer2",
          variable2: 3,
        },
        ttc: {
          question1: 15,
          question2: 25,
        },
        meta: {
          source: "https://example2.com",
          url: "https://example2.com",
          userAgent: {
            browser: "Firefox",
            os: "Linux",
            device: "Laptop",
          },
          country: "CA",
          action: "submit",
        },
      };

      const response = await request.post(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: responseBody,
      });

      expect(response.ok()).toBe(true);
      const responseJson = await response.json();
      expect(responseJson.data).toHaveProperty("id");
      createdResponseId2 = responseJson.data.id;
    });

    await test.step("Get Responses from API sorting by createdAt desc", async () => {
      const queryParams = {
        limit: 10,
        skip: 0,
        sortBy: "createdAt",
        order: "desc",
      };

      const response = await request.get(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.length).toBeGreaterThan(0);

      const createdResponse1 = responseBody.data.find((resp) => resp.id === createdResponseId1);

      const createdResponse2 = responseBody.data.find((resp) => resp.id === createdResponseId2);

      expect(createdResponse1).toMatchObject({
        createdAt: "2021-01-01T00:00:00.000Z",
        updatedAt: "2021-01-01T00:00:00.000Z",
        surveyId: surveyId,
        finished: true,
        language: "en",
        data: {
          question1: "answer1",
          question2: 2,
          question3: ["answer3", "answer4"],
          question4: { subquestion1: "answer5" },
        },
        variables: {
          variable1: "answer1",
          variable2: 2,
        },
        ttc: {
          question1: 10,
          question2: 20,
        },
        meta: {
          source: "https://example.com",
          url: "https://example.com",
          userAgent: {
            browser: "Chrome",
            os: "Windows",
            device: "Desktop",
          },
          country: "US",
          action: "click",
        },
      });

      expect(createdResponse2).toMatchObject({
        createdAt: "2021-01-02T00:00:00.000Z",
        updatedAt: "2021-01-02T00:00:00.000Z",
        surveyId: surveyId,
        finished: true,
        language: "en",
        data: {
          question1: "answer2",
          question2: 3,
          question3: ["answer5", "answer6"],
          question4: { subquestion1: "answer7" },
        },
        variables: {
          variable1: "answer2",
          variable2: 3,
        },
        ttc: {
          question1: 15,
          question2: 25,
        },
        meta: {
          source: "https://example2.com",
          url: "https://example2.com",
          userAgent: {
            browser: "Firefox",
            os: "Linux",
            device: "Laptop",
          },
          country: "CA",
          action: "submit",
        },
      });

      // Check if the responses are sorted correctly
      expect(responseBody.data[0].id).toBe(createdResponseId2);
      expect(responseBody.data[1].id).toBe(createdResponseId1);
    });

    await test.step("Get Responses from API sorting by updatedAt asc", async () => {
      const queryParams = {
        limit: 10,
        skip: 0,
        sortBy: "updatedAt",
        order: "asc",
      };

      const response = await request.get(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.length).toBeGreaterThan(0);

      const createdResponse1 = responseBody.data.find((resp) => resp.id === createdResponseId1);

      const createdResponse2 = responseBody.data.find((resp) => resp.id === createdResponseId2);

      // Check if the responses are sorted correctly
      expect(responseBody.data[0].id).toBe(createdResponseId1);
      expect(responseBody.data[1].id).toBe(createdResponseId2);
    });

    await test.step("Get Responses from API 1 response per page - Page 1", async () => {
      const queryParams = {
        limit: 1,
        skip: 0,
        sortBy: "updatedAt",
        order: "asc",
      };

      const response = await request.get(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.length).toBe(1);

      const createdResponse1 = responseBody.data.find((resp) => resp.id === createdResponseId1);

      expect(responseBody.data[0].id).toBe(createdResponseId1);
    });

    await test.step("Get Responses from API 1 response per page - Page 2", async () => {
      const queryParams = {
        limit: 1,
        skip: 1,
        sortBy: "updatedAt",
        order: "asc",
      };

      const response = await request.get(RESPONSES_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.length).toBe(1);

      const createdResponse2 = responseBody.data.find((resp) => resp.id === createdResponseId2);

      expect(responseBody.data[0].id).toBe(createdResponse2.id);
    });

    await test.step("Update Response by ID via API", async () => {
      const updatedResponseBody = {
        createdAt: "2021-01-01T00:00:00.000Z",
        updatedAt: "2021-01-03T00:00:00.000Z",
        surveyId: surveyId,
        finished: false,
        language: "fr",
        endingId: null,
        contactId: null,
        contactAttributes: null,
        singleUseId: null,
        displayId: null,
        data: {
          question1: "updatedAnswer1",
          question2: 5,
          question3: ["updatedAnswer3", "updatedAnswer4"],
          question4: { subquestion1: "updatedAnswer5" },
        },
        variables: {
          variable1: "updatedAnswer1",
          variable2: 5,
        },
        ttc: {
          question1: 30,
          question2: 40,
        },
        meta: {
          source: "https://updatedexample.com",
          url: "https://updatedexample.com",
          userAgent: {
            browser: "Safari",
            os: "macOS",
            device: "Tablet",
          },
          country: "FR",
          action: "update",
        },
      };

      const response = await request.put(`${RESPONSES_API_URL}/${createdResponseId1}`, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: updatedResponseBody,
      });

      expect(response.ok()).toBe(true);
    });

    await test.step("Get Response by ID from API", async () => {
      const response = await request.get(`${RESPONSES_API_URL}/${createdResponseId1}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.id).toEqual(createdResponseId1);
      expect(responseBody.data).toMatchObject({
        createdAt: "2021-01-01T00:00:00.000Z",
        updatedAt: "2021-01-03T00:00:00.000Z",
        surveyId: surveyId,
        finished: false,
        language: "fr",
        endingId: null,
        contactId: null,
        contactAttributes: null,
        singleUseId: null,
        displayId: null,
        data: {
          question1: "updatedAnswer1",
          question2: 5,
          question3: ["updatedAnswer3", "updatedAnswer4"],
          question4: { subquestion1: "updatedAnswer5" },
        },
        variables: {
          variable1: "updatedAnswer1",
          variable2: 5,
        },
        ttc: {
          question1: 30,
          question2: 40,
        },
        meta: {
          source: "https://updatedexample.com",
          url: "https://updatedexample.com",
          userAgent: {
            browser: "Safari",
            os: "macOS",
            device: "Tablet",
          },
          country: "FR",
          action: "update",
        },
      });
    });

    await test.step("Delete Responses via API", async () => {
      const response1 = await request.delete(`${RESPONSES_API_URL}/${createdResponseId1}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response1.ok()).toBe(true);

      const response2 = await request.delete(`${RESPONSES_API_URL}/${createdResponseId2}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response2.ok()).toBe(true);
    });
  });
});
