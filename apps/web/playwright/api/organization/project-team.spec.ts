import { PROJECT_TEAMS_API_URL } from "@/playwright/api/constants";
import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for ProjectTeams", () => {
  test("Create, Retrieve, Update, and Delete ProjectTeams via API", async ({ page, users, request }) => {
    let apiKey;
    try {
      ({ apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error logging in / retrieving API key");
      throw error;
    }

    let createdProjectTeamId: string;

    await test.step("Create ProjectTeam via API", async () => {
      const body = {
        projectId: "testProject",
        teamId: "testTeam",
        permission: "READ",
      };
      const response = await request.post(PROJECT_TEAMS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      createdProjectTeamId = responseBody.data.id;
      expect(createdProjectTeamId).toBeTruthy();
    });

    await test.step("Retrieve ProjectTeams via API", async () => {
      const queryParams = { limit: 10, skip: 0 };
      const response = await request.get(PROJECT_TEAMS_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.find((pt: any) => pt.id === createdProjectTeamId)).toBeTruthy();
    });

    await test.step("Update ProjectTeam by ID via API", async () => {
      const body = {
        permission: "WRITE",
      };
      const response = await request.put(`${PROJECT_TEAMS_API_URL}/${createdProjectTeamId}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.permission).toBe("WRITE");
    });

    await test.step("Get ProjectTeam by ID from API", async () => {
      const response = await request.get(`${PROJECT_TEAMS_API_URL}/${createdProjectTeamId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.id).toEqual(createdProjectTeamId);
    });

    await test.step("Delete ProjectTeam via API", async () => {
      const response = await request.delete(`${PROJECT_TEAMS_API_URL}/${createdProjectTeamId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
    });
  });
});
