import { SURVEYS_API_URL, WEBHOOKS_API_URL } from "@/playwright/api/constants";
import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for Webhooks", () => {
  test("Create, Retrieve, Update, and Delete Webhooks via API", async ({ page, users, request }) => {
    let environmentId, apiKey;

    try {
      ({ environmentId, apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error during login and getting API key");
      throw error;
    }

    let surveyId: string;

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

    let createdWebhookId: string;

    await test.step("Create Webhook via API", async () => {
      const webhookBody = {
        environmentId,
        name: "New Webhook",
        url: "https://examplewebhook.com",
        source: "user",
        triggers: ["responseFinished"],
        surveyIds: [surveyId],
      };

      const response = await request.post(WEBHOOKS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: webhookBody,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("New Webhook");
      createdWebhookId = responseBody.data.id;
    });

    await test.step("Retrieve Webhooks via API", async () => {
      const params = { limit: 10, skip: 0, sortBy: "createdAt", order: "desc" };
      const response = await request.get(WEBHOOKS_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      const newlyCreated = responseBody.data.find((hook: any) => hook.id === createdWebhookId);
      expect(newlyCreated).toBeTruthy();
      expect(newlyCreated.name).toBe("New Webhook");
    });

    await test.step("Update Webhook by ID via API", async () => {
      const updatedBody = {
        environmentId,
        name: "Updated Webhook",
        url: "https://updated-webhook-url.com",
        source: "zapier",
        triggers: ["responseCreated"],
        surveyIds: [surveyId],
      };

      const response = await request.put(`${WEBHOOKS_API_URL}/${createdWebhookId}`, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: updatedBody,
      });

      expect(response.ok()).toBe(true);
      const responseJson = await response.json();
      expect(responseJson.data.name).toBe("Updated Webhook");
      expect(responseJson.data.source).toBe("zapier");
    });

    await test.step("Delete Webhook via API", async () => {
      const deleteResponse = await request.delete(`${WEBHOOKS_API_URL}/${createdWebhookId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(deleteResponse.ok()).toBe(true);
    });
  });
});
