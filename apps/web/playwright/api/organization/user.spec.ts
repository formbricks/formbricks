import { ME_API_URL, TEAMS_API_URL, USERS_API_URL } from "@/playwright/api/constants";
import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for Users", () => {
  test("Create, Retrieve, Filter, and Update Users via API", async ({ page, users, request }) => {
    let apiKey;
    let organizationId: string;
    let createdUserId: string;
    let teamName = "New Team from API";

    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const userEmail = `usere2etest${randomSuffix}@formbricks-test.com`;

    try {
      ({ apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error during login and getting API key");
      throw error;
    }

    await test.step("Get Organization ID", async () => {
      const response = await request.get(ME_API_URL, {
        headers: { "x-api-key": apiKey },
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data?.organizationId).toBeTruthy();
      organizationId = responseBody.data.organizationId;
    });

    // Create a team to use for the project team
    await test.step("Create Team via API", async () => {
      const teamBody = {
        organizationId: organizationId,
        name: teamName,
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
      expect(responseBody.data.name).toEqual(teamName);
    });

    await test.step("Create User via API", async () => {
      const userData = {
        name: "E2E Test User",
        email: userEmail,
        role: "manager",
        isActive: true,
        teams: [teamName],
      };

      const response = await request.post(USERS_API_URL(organizationId), {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        data: userData,
      });

      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toEqual("E2E Test User");
      createdUserId = responseBody.data.id;
    });

    await test.step("Retrieve All Users via API", async () => {
      const response = await request.get(USERS_API_URL(organizationId), {
        headers: { "x-api-key": apiKey },
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.some((user: any) => user.id === createdUserId)).toBe(true);
    });

    await test.step("Filter Users by Email via API", async () => {
      const queryParams = { email: userEmail };
      const response = await request.get(USERS_API_URL(organizationId), {
        headers: { "x-api-key": apiKey },
        params: queryParams,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();

      expect(responseBody.data.length).toBeGreaterThan(0);
      expect(responseBody.data[0].email).toBe(userEmail);
    });

    await test.step("Partially Update User via PATCH", async () => {
      const patchData = { email: userEmail, name: "Updated E2E Name" };
      const response = await request.patch(USERS_API_URL(organizationId), {
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        data: patchData,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toBe("Updated E2E Name");
    });

    await test.step("Fully Update User via PATCH", async () => {
      const patchData = {
        email: userEmail,
        name: "Fully Updated E2E",
        role: "member",
        teams: [],
        isActive: false,
      };
      const response = await request.patch(USERS_API_URL(organizationId), {
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        data: patchData,
      });
      expect(response.ok()).toBe(true);
      const responseBody = await response.json();
      expect(responseBody.data.name).toBe("Fully Updated E2E");
      expect(responseBody.data.role).toBe("member");
      expect(responseBody.data.isActive).toBe(false);
      expect(responseBody.data.teams).toEqual([]);
    });
  });
});
