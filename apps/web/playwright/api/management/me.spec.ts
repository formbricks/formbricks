import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";

test.describe("API Tests for Management Me", () => {
  test("Authenticated v1 me endpoint never exposes secret auth fields", async ({ page, users }) => {
    const name = `Security Me User ${Date.now()}`;
    const email = `security-me-${Date.now()}@example.com`;

    try {
      const user = await users.create({ name, email });
      await user.login();

      const response = await page.context().request.get("/api/v1/management/me");
      expect(response.ok()).toBe(true);

      const responseBody = await response.json();

      expect(responseBody).toMatchObject({
        id: expect.any(String),
        name,
        email,
        twoFactorEnabled: expect.any(Boolean),
        identityProvider: expect.any(String),
        notificationSettings: expect.any(Object),
        locale: expect.any(String),
        isActive: expect.any(Boolean),
      });
      expect(responseBody).not.toHaveProperty("password");
      expect(responseBody).not.toHaveProperty("twoFactorSecret");
      expect(responseBody).not.toHaveProperty("backupCodes");
      expect(responseBody).not.toHaveProperty("identityProviderAccountId");
    } catch (error) {
      logger.error(error, "Error during management me API security test");
      throw error;
    }
  });
});
