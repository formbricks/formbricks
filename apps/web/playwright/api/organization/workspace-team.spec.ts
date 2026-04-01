import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { ME_API_URL, TEAMS_API_URL, WORKSPACE_TEAMS_API_URL } from "@/playwright/api/constants";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for WorkspaceTeams", () => {
  test("Create, Retrieve, Update, and Delete WorkspaceTeams via API", async ({ page, users, request }) => {
    let apiKey: string;
    try {
      ({ apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error logging in / retrieving API key");
      throw error;
    }

    let organizationId: string;
    let workspaceId: string;
    let teamId: string;

    // Get organization ID using the me endpoint
    await test.step("Get Organization ID", async () => {
      const response = await request.get(ME_API_URL, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      expect(response.ok()).toBe(true);
      const responseBody = (await response.json()) as {
        data: { organizationId: string; environmentPermissions: { workspaceId: string }[] };
      };

      expect(responseBody.data).toBeTruthy();
      expect(responseBody.data.organizationId).toBeTruthy();

      organizationId = responseBody.data.organizationId;
      workspaceId = responseBody.data.environmentPermissions[0].workspaceId;
    });

    // Create a team to use for the workspace team
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
      const responseBody = (await response.json()) as { data: { name: string; id: string } };
      expect(responseBody.data.name).toEqual("New Team from API");
      teamId = responseBody.data.id;
    });

    await test.step("Create WorkspaceTeam via API", async () => {
      const body = {
        workspaceId: workspaceId,
        teamId: teamId,
        permission: "readWrite",
      };
      const response = await request.post(WORKSPACE_TEAMS_API_URL(organizationId), {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });

      expect(response.ok()).toBe(true);
    });

    await test.step("Retrieve WorkspaceTeams via API", async () => {
      const queryParams = { teamId: teamId, workspaceId: workspaceId };
      const response = await request.get(WORKSPACE_TEAMS_API_URL(organizationId), {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
      const responseBody = (await response.json()) as {
        data: { teamId: string; workspaceId: string }[];
      };
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(
        responseBody.data.find((pt) => pt.teamId === teamId && pt.workspaceId === workspaceId)
      ).toBeTruthy();
    });

    await test.step("Update WorkspaceTeam by ID via API", async () => {
      const body = {
        permission: "read",
        teamId: teamId,
        workspaceId: workspaceId,
      };
      const response = await request.put(`${WORKSPACE_TEAMS_API_URL(organizationId)}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body,
      });

      expect(response.ok()).toBe(true);
      const responseBody = (await response.json()) as { data: { permission: string } };
      expect(responseBody.data.permission).toBe("read");
    });

    await test.step("Delete WorkspaceTeam via API", async () => {
      const queryParams = { teamId: teamId, workspaceId: workspaceId };
      const response = await request.delete(`${WORKSPACE_TEAMS_API_URL(organizationId)}`, {
        headers: {
          "x-api-key": apiKey,
        },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
    });
  });
});
