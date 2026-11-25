import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../lib/fixtures";
import { HEALTH_API_URL } from "./constants";

test.describe("API Tests for Health Endpoint", () => {
  test("Health check returns 200 with dependency status", async ({ request }) => {
    try {
      // Make request to health endpoint (no authentication required)
      const response = await request.get(HEALTH_API_URL);

      // Should always return 200 if the health check endpoint can execute
      expect(response.status()).toBe(200);

      const responseBody = await response.json();

      // Verify response structure
      expect(responseBody).toHaveProperty("data");
      expect(responseBody.data).toHaveProperty("main_database");
      expect(responseBody.data).toHaveProperty("cache_database");

      // Verify data types are boolean
      expect(typeof responseBody.data.main_database).toBe("boolean");
      expect(typeof responseBody.data.cache_database).toBe("boolean");

      // Log the health status for debugging
      logger.info(
        {
          main_database: responseBody.data.main_database,
          cache_database: responseBody.data.cache_database,
        },
        "Health check status"
      );

      // In a healthy system, we expect both to be true
      // But we don't fail the test if they're false - that's what the health check is for
      if (!responseBody.data.main_database) {
        logger.warn("Main database is unhealthy");
      }

      if (!responseBody.data.cache_database) {
        logger.warn("Cache database is unhealthy");
      }
    } catch (error) {
      logger.error(error, "Error during health check API test");
      throw error;
    }
  });
});
