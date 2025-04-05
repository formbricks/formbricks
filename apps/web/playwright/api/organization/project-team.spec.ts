import { ME_API_URL, PROJECT_TEAMS_API_URL, TEAMS_API_URL } from "@/playwright/api/constants";
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

    let organizationId, projectId, teamId: string;

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
      projectId = responseBody.data.environmentPermissions[0].projectId;
    });

    // Create a team to use for the project team
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
      teamId = responseBody.data.id;
    });

    await test.step("Create ProjectTeam via API", async () => {
      const body = {
        projectId: projectId,
        teamId: teamId,
        permission: "readWrite",
      };
      const response = await request.post(PROJECT_TEAMS_API_URL(organizationId), {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });

      expect(response.ok()).toBe(true);
    });

    await test.step("Retrieve ProjectTeams via API", async () => {
      const queryParams = { teamId: teamId, projectId: projectId };
      const response = await request.get(PROJECT_TEAMS_API_URL(organizationId), {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(
        responseBody.data.find((pt: any) => pt.teamId === teamId && pt.projectId === projectId)
      ).toBeTruthy();
    });

    await test.step("Update ProjectTeam by ID via API", async () => {
      const body = {
        permission: "read",
        teamId: teamId,
        projectId: projectId,
      };
      const response = await request.put(`${PROJECT_TEAMS_API_URL(organizationId)}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.permission).toBe("read");
    });

    await test.step("Delete ProjectTeam via API", async () => {
      const queryParams = { teamId: teamId, projectId: projectId };
      const response = await request.delete(`${PROJECT_TEAMS_API_URL(organizationId)}`, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
    });
  });
});
