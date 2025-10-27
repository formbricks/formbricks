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

  test("Health check response time is reasonable", async ({ request }) => {
    try {
      const startTime = Date.now();

      const response = await request.get(HEALTH_API_URL);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status()).toBe(200);

      // Health check should respond within 5 seconds
      expect(responseTime).toBeLessThan(5000);

      logger.info({ responseTime }, "Health check response time");
    } catch (error) {
      logger.error(error, "Error during health check performance test");
      throw error;
    }
  });

  test("Health check is accessible without authentication", async ({ request }) => {
    try {
      // Make request without any headers or authentication
      const response = await request.get(HEALTH_API_URL, {
        headers: {
          // Explicitly no x-api-key or other auth headers
        },
      });

      // Should be accessible without authentication
      expect(response.status()).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toHaveProperty("data");
    } catch (error) {
      logger.error(error, "Error during unauthenticated health check test");
      throw error;
    }
  });

  test("Health check handles CORS properly", async ({ request }) => {
    try {
      // Test with OPTIONS request (preflight)
      const optionsResponse = await request.fetch(HEALTH_API_URL, {
        method: "OPTIONS",
      });

      // OPTIONS should succeed or at least not be a server error
      expect(optionsResponse.status()).not.toBe(500);

      // Test regular GET request
      const getResponse = await request.get(HEALTH_API_URL);
      expect(getResponse.status()).toBe(200);
    } catch (error) {
      logger.error(error, "Error during CORS health check test");
      throw error;
    }
  });

  test("Health check OpenAPI schema compliance", async ({ request }) => {
    try {
      const response = await request.get(HEALTH_API_URL);
      expect(response.status()).toBe(200);

      const responseBody = await response.json();

      // Verify it matches our OpenAPI schema
      expect(responseBody).toMatchObject({
        data: {
          main_database: expect.any(Boolean),
          cache_database: expect.any(Boolean),
        },
      });

      // Ensure no extra properties in the response data
      const dataKeys = Object.keys(responseBody.data);
      expect(dataKeys).toHaveLength(2);
      expect(dataKeys).toContain("main_database");
      expect(dataKeys).toContain("cache_database");
    } catch (error) {
      logger.error(error, "Error during OpenAPI schema compliance test");
      throw error;
    }
  });
});
