import { ROLES_API_URL } from "@/playwright/api/constants";
import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../lib/fixtures";
import { loginAndGetApiKey } from "../lib/utils";

test.describe("API Tests for Roles", () => {
  test("Retrieve Roles via API", async ({ page, users, request }) => {
    let apiKey;

    try {
      ({ apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      logger.error(error, "Error during login and getting API key");
      throw error;
    }

    const response = await request.get(ROLES_API_URL, {
      headers: {
        "x-api-key": apiKey,
      },
    });
    expect(response.ok()).toBe(true);
    const responseBody = await response.json();

    expect(Array.isArray(responseBody.data)).toBe(true);
    expect(responseBody.data.length).toBeGreaterThan(0);
  });
});
