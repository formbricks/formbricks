import { ME_API_URL, TEAMS_API_URL } from "@/playwright/api/constants";
import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for Teams", () => {
  test("Create, Retrieve, Update, and Delete Teams via API", async ({ page, users, request }) => {
    let apiKey;
    try {
      ({ apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error during login and getting API key");
      throw error;
    }

    let organizationId, createdTeamId: string;

    // Get organization ID using the me endpoint
    await test.step("Get Organization ID", async () => {
      const response = await request.get(ME_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();

      expect(responseBody.data).toBeTruthy();
      expect(responseBody.data.organizationId).toBeTruthy();

      organizationId = responseBody.data.organizationId;
    });

    await test.step("Create Team via API", async () => {
      const teamBody = {
        organizationId: organizationId,
        name: "New Team from API",
      };

      const response = await request.post(TEAMS_API_URL(organizationId), {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: teamBody,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("New Team from API");
      createdTeamId = responseBody.data.id;
    });

    await test.step("Retrieve Teams via API", async () => {
      const queryParams = { limit: 10, skip: 0, sortBy: "createdAt", order: "asc" };

      const response = await request.get(TEAMS_API_URL(organizationId), {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.find((team: any) => team.id === createdTeamId)).toBeTruthy();
    });

    await test.step("Update Team by ID via API", async () => {
      const updatedTeamBody = {
        name: "Updated Team from API",
      };

      const response = await request.put(`${TEAMS_API_URL(organizationId)}/${createdTeamId}`, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: updatedTeamBody,
      });
      expect(response.ok()).toBe(true);
      const responseJson = await response.json();
      expect(responseJson.data.name).toBe("Updated Team from API");
    });

    await test.step("Get Team by ID from API", async () => {
      const response = await request.get(`${TEAMS_API_URL(organizationId)}/${createdTeamId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.id).toEqual(createdTeamId);
      expect(responseBody.data.name).toEqual("Updated Team from API");
    });

    await test.step("Delete Team via API", async () => {
      const response = await request.delete(`${TEAMS_API_URL(organizationId)}/${createdTeamId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
    });
  });
});
