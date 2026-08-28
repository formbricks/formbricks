import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";
import { SURVEYS_API_URL } from "../constants";

const V1_WEBHOOKS_API_URL = "/api/v1/webhooks";

// ENG-2270: integrations built against API v1 (Zapier, Make, n8n) read `environmentId` off the
// surveys they list and post it back when subscribing a webhook. This walks that exact path so the
// legacy field can't silently disappear from v1 again.
test.describe("API v1 legacy environmentId", () => {
  test("Zapier-style webhook subscription round-trips environmentId from the survey list", async ({
    page,
    users,
    request,
  }) => {
    let workspaceId: string;
    let apiKey: string;

    try {
      ({ workspaceId, apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error during login and getting API key");
      throw error;
    }

    let surveyId: string;

    await test.step("Create Survey via API", async () => {
      const response = await request.post(SURVEYS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: {
          workspaceId,
          type: "link",
          name: "Survey for legacy environmentId",
          questions: [
            {
              id: "jpvm9b73u06xdrhzi11k2h76",
              type: "openText",
              headline: { default: "What would you like to know?" },
              required: true,
              inputType: "text",
            },
          ],
        },
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      surveyId = responseBody.data.id;
      expect(responseBody.data.environmentId).toBeTruthy();
    });

    let environmentId: string;

    await test.step("Survey list exposes environmentId alongside workspaceId", async () => {
      const response = await request.get(SURVEYS_API_URL, {
        headers: { "x-api-key": apiKey },
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      const survey = responseBody.data.find((item: { id: string }) => item.id === surveyId);

      expect(survey).toBeTruthy();
      expect(survey.workspaceId).toBe(workspaceId);
      expect(typeof survey.environmentId).toBe("string");
      expect(survey.environmentId).not.toBe("undefined");

      environmentId = survey.environmentId;
    });

    let createdWebhookId: string;

    await test.step("Create webhook with environmentId only", async () => {
      const response = await request.post(V1_WEBHOOKS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: {
          environmentId,
          name: "Zapier Response Finished",
          url: "https://example.com/zapier-webhook",
          source: "zapier",
          triggers: ["responseFinished"],
          surveyIds: [surveyId],
        },
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.workspaceId).toBe(workspaceId);
      expect(responseBody.data.environmentId).toBe(environmentId);
      createdWebhookId = responseBody.data.id;
    });

    await test.step("Webhook list and detail expose environmentId", async () => {
      const listResponse = await request.get(V1_WEBHOOKS_API_URL, {
        headers: { "x-api-key": apiKey },
      });

      expect(listResponse.ok()).toBe(true);
      const listBody = await listResponse.json();
      const webhook = listBody.data.find((item: { id: string }) => item.id === createdWebhookId);
      expect(webhook.environmentId).toBe(environmentId);

      const detailResponse = await request.get(`${V1_WEBHOOKS_API_URL}/${createdWebhookId}`, {
        headers: { "x-api-key": apiKey },
      });

      expect(detailResponse.ok()).toBe(true);
      const detailBody = await detailResponse.json();
      expect(detailBody.data.environmentId).toBe(environmentId);
    });

    await test.step("Delete webhook via API", async () => {
      const response = await request.delete(`${V1_WEBHOOKS_API_URL}/${createdWebhookId}`, {
        headers: { "x-api-key": apiKey },
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.environmentId).toBe(environmentId);
    });
  });
});
