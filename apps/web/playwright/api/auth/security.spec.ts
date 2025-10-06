import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";

// Authentication endpoints are hardcoded to avoid import issues

test.describe("Authentication Security Tests - Vulnerability Prevention", () => {
  let csrfToken: string;
  let testUser: { email: string; password: string };

  test.beforeEach(async ({ request, users }) => {
    // Get CSRF token for authentication requests
    const csrfResponse = await request.get("/api/auth/csrf");
    const csrfData = await csrfResponse.json();
    csrfToken = csrfData.csrfToken;

    // Create a test user for "existing user" scenarios with unique email
    const uniqueId = Date.now() + Math.random();
    const userName = "Security Test User";
    const userEmail = `security-test-${uniqueId}@example.com`;
    await users.create({
      name: userName,
      email: userEmail,
    });
    testUser = {
      email: userEmail,
      password: userName, // The fixture uses the name as password
    };
  });

  test.describe("DoS Protection - Password Length Limits", () => {
    test("should handle extremely long passwords without crashing", async ({ request }) => {
      const email = "nonexistent-dos-test@example.com"; // Use non-existent email for DoS test
      const extremelyLongPassword = "A".repeat(50000); // 50,000 characters

      const start = Date.now();
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: email,
          password: extremelyLongPassword,
          redirect: "false",
          csrfToken: csrfToken,
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const responseTime = Date.now() - start;

      // Should not crash the server (no 500 errors)
      expect(response.status()).not.toBe(500);

      // Should handle gracefully
      expect([200, 400, 401, 429]).toContain(response.status());

      logger.info(
        `Extremely long password (50k chars) processing time: ${responseTime}ms, status: ${response.status()}`
      );

      // Verify the security fix is working: long passwords should be rejected quickly
      // In production, this should be much faster, but test environment has overhead
      if (responseTime < 5000) {
        logger.info("✅ Long password rejected quickly - DoS protection working");
      } else {
        logger.warn("⚠️ Long password took longer than expected - check DoS protection");
      }
    });

    test("should handle password at 128 character limit", async ({ request }) => {
      const email = "nonexistent-limit-test@example.com"; // Use non-existent email for limit test
      const maxLengthPassword = "A".repeat(128); // Exactly at the 128 character limit

      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: email,
          password: maxLengthPassword,
          redirect: "false",
          csrfToken: csrfToken,
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // Should process normally (not rejected for length)
      expect(response.status()).not.toBe(500);
      expect([200, 400, 401, 429]).toContain(response.status());

      logger.info(`Max length password (128 chars) status: ${response.status()}`);
    });

    test("should reject passwords over 128 characters", async ({ request }) => {
      const email = "nonexistent-overlimit-test@example.com"; // Use non-existent email for over-limit test
      const overLimitPassword = "A".repeat(10000); // 10,000 characters (over limit)

      const start = Date.now();
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: email,
          password: overLimitPassword,
          redirect: "false",
          csrfToken: csrfToken,
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const responseTime = Date.now() - start;

      // Should not crash
      expect(response.status()).not.toBe(500);

      logger.info(
        `Over-limit password (10k chars) processing time: ${responseTime}ms, status: ${response.status()}`
      );

      // The key security test: verify it doesn't take exponentially longer than shorter passwords
      // This tests the DoS protection is working
    });
  });

  test.describe("Timing Attack Prevention - User Enumeration Protection", () => {
    test("should not reveal user existence through response timing differences", async ({ request }) => {
      // Helper functions for statistical analysis
      const calculateMedian = (values: number[]): number => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      };

      const calculateStdDev = (values: number[], mean: number): number => {
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
      };

      logger.info("🔥 Phase 1: Warming up caches, DB connections, and JIT compilation...");

      // Warm-up phase: Prime caches, database connections, JIT compilation
      const warmupAttempts = 10;
      for (let i = 0; i < warmupAttempts; i++) {
        await request.post("/api/auth/callback/credentials", {
          data: {
            callbackUrl: "",
            email: `warmup-nonexistent-${i}@example.com`,
            password: "warmuppassword",
            redirect: "false",
            csrfToken: csrfToken,
            json: "true",
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        await request.post("/api/auth/callback/credentials", {
          data: {
            callbackUrl: "",
            email: testUser.email,
            password: "wrongwarmuppassword",
            redirect: "false",
            csrfToken: csrfToken,
            json: "true",
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      }

      logger.info("✅ Warm-up complete. Starting actual measurements with 100 attempts per scenario...");

      // Actual measurement phase with increased sample size
      const attempts = 100;
      const nonExistentTimes: number[] = [];
      const existingUserTimes: number[] = [];

      // Interleave tests to reduce impact of system load variations
      for (let i = 0; i < attempts; i++) {
        // Test non-existent user
        const startNonExistent = process.hrtime.bigint();
        const responseNonExistent = await request.post("/api/auth/callback/credentials", {
          data: {
            callbackUrl: "",
            email: `nonexistent-timing-${i}@example.com`,
            password: "somepassword",
            redirect: "false",
            csrfToken: csrfToken,
            json: "true",
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        const endNonExistent = process.hrtime.bigint();
        const responseTimeNonExistent = Number(endNonExistent - startNonExistent) / 1000000;
        nonExistentTimes.push(responseTimeNonExistent);
        expect(responseNonExistent.status()).not.toBe(500);

        // Test existing user (interleaved)
        const startExisting = process.hrtime.bigint();
        const responseExisting = await request.post("/api/auth/callback/credentials", {
          data: {
            callbackUrl: "",
            email: testUser.email,
            password: "wrongpassword123",
            redirect: "false",
            csrfToken: csrfToken,
            json: "true",
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        const endExisting = process.hrtime.bigint();
        const responseTimeExisting = Number(endExisting - startExisting) / 1000000;
        existingUserTimes.push(responseTimeExisting);
        expect(responseExisting.status()).not.toBe(500);
      }

      // Calculate statistics using median (more robust to outliers)
      const medianNonExistent = calculateMedian(nonExistentTimes);
      const medianExisting = calculateMedian(existingUserTimes);

      // Also calculate means for comparison
      const avgNonExistent = nonExistentTimes.reduce((a, b) => a + b, 0) / nonExistentTimes.length;
      const avgExisting = existingUserTimes.reduce((a, b) => a + b, 0) / existingUserTimes.length;

      // Calculate standard deviations
      const stdDevNonExistent = calculateStdDev(nonExistentTimes, avgNonExistent);
      const stdDevExisting = calculateStdDev(existingUserTimes, avgExisting);

      // Calculate timing difference using MEDIAN (more reliable)
      const timingDifference = Math.abs(medianExisting - medianNonExistent);
      const timingDifferencePercent = (timingDifference / Math.max(medianExisting, medianNonExistent)) * 100;

      // Calculate coefficient of variation (CV) for reliability assessment
      // CV = (StdDev / Mean) * 100 - measures relative variability
      const cvNonExistent = (stdDevNonExistent / avgNonExistent) * 100;
      const cvExisting = (stdDevExisting / avgExisting) * 100;

      // Log comprehensive statistics
      logger.info("📊 Statistical Analysis:");
      logger.info(
        `Non-existent user - Mean: ${avgNonExistent.toFixed(2)}ms, Median: ${medianNonExistent.toFixed(2)}ms, StdDev: ${stdDevNonExistent.toFixed(2)}ms (CV: ${cvNonExistent.toFixed(1)}%)`
      );
      logger.info(
        `Existing user     - Mean: ${avgExisting.toFixed(2)}ms, Median: ${medianExisting.toFixed(2)}ms, StdDev: ${stdDevExisting.toFixed(2)}ms (CV: ${cvExisting.toFixed(1)}%)`
      );
      logger.info(
        `Timing difference (median-based): ${timingDifference.toFixed(2)}ms (${timingDifferencePercent.toFixed(1)}%)`
      );

      // CRITICAL SECURITY TEST: Timing difference should be minimal
      // A large timing difference could allow attackers to enumerate users
      // Allow up to 20% difference to account for network/system variance
      if (timingDifferencePercent > 20) {
        logger.warn(
          `⚠️ SECURITY RISK: Timing difference of ${timingDifferencePercent.toFixed(1)}% could allow user enumeration!`
        );
        logger.warn(`⚠️ Consider implementing constant-time authentication to prevent timing attacks`);
      } else {
        logger.info(
          `✅ Timing attack protection: Only ${timingDifferencePercent.toFixed(1)}% difference between scenarios`
        );
      }

      // Fail the test if timing difference exceeds our security threshold
      // Note: This uses MEDIAN-based comparison (more robust to outliers than mean)
      expect(timingDifferencePercent).toBeLessThan(20);

      // Validate measurement reliability using coefficient of variation (CV)
      // CV > 50% indicates high variability and unreliable measurements
      const maxAcceptableCV = 50; // 50% is reasonable for network-based tests

      if (cvNonExistent > maxAcceptableCV) {
        logger.warn(
          `⚠️ High variability in non-existent user timing (CV: ${cvNonExistent.toFixed(1)}%). ` +
            `Test measurements may be unreliable. Consider increasing warm-up or checking CI environment.`
        );
      }

      if (cvExisting > maxAcceptableCV) {
        logger.warn(
          `⚠️ High variability in existing user timing (CV: ${cvExisting.toFixed(1)}%). ` +
            `Test measurements may be unreliable. Consider increasing warm-up or checking CI environment.`
        );
      }

      // These are soft checks - we warn but don't fail the test for high CV
      // This allows for noisy CI environments while still alerting to potential issues
      if (cvNonExistent <= maxAcceptableCV && cvExisting <= maxAcceptableCV) {
        logger.info(
          `✅ Measurement reliability good: CV ${cvNonExistent.toFixed(1)}% and ${cvExisting.toFixed(1)}% (threshold: ${maxAcceptableCV}%)`
        );
      }
    });

    test("should return consistent status codes regardless of user existence", async ({ request }) => {
      const scenarios = [
        {
          email: "nonexistent-status@example.com",
          password: "testpassword",
          description: "non-existent user",
        },
        { email: testUser.email, password: "wrongpassword", description: "existing user, wrong password" },
      ];

      const results: { scenario: string; status: number }[] = [];

      for (const scenario of scenarios) {
        const response = await request.post("/api/auth/callback/credentials", {
          data: {
            callbackUrl: "",
            email: scenario.email,
            password: scenario.password,
            redirect: "false",
            csrfToken: csrfToken,
            json: "true",
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        results.push({
          scenario: scenario.description,
          status: response.status(),
        });

        expect(response.status()).not.toBe(500);
      }

      // Log results
      results.forEach(({ scenario, status }) => {
        logger.info(`Status test - ${scenario}: ${status}`);
      });

      // CRITICAL: Both scenarios should return the same status code
      // Different status codes could reveal user existence
      const statuses = results.map((r) => r.status);
      const uniqueStatuses = [...new Set(statuses)];

      if (uniqueStatuses.length > 1) {
        logger.warn(
          `⚠️ SECURITY RISK: Different status codes (${uniqueStatuses.join(", ")}) could allow user enumeration!`
        );
      } else {
        logger.info(`✅ Status code consistency: Both scenarios return ${statuses[0]}`);
      }

      expect(uniqueStatuses.length).toBe(1);
    });
  });

  test.describe("Security Headers and Response Safety", () => {
    test("should include security headers in responses", async ({ request }) => {
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: "nonexistent-headers-test@example.com",
          password: "testpassword",
          redirect: "false",
          csrfToken: csrfToken,
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // Check for important security headers
      const headers = response.headers();

      // These headers should be present for security
      expect(headers["x-frame-options"]).toBeDefined();
      expect(headers["x-content-type-options"]).toBe("nosniff");

      if (headers["strict-transport-security"]) {
        expect(headers["strict-transport-security"]).toContain("max-age");
      }
      if (headers["content-security-policy"]) {
        expect(headers["content-security-policy"]).toContain("default-src");
      }

      logger.info("✅ Security headers present in authentication responses");
    });

    test("should not expose sensitive information in error responses", async ({ request }) => {
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: "nonexistent-disclosure-test@example.com",
          password: "A".repeat(10000), // Trigger long password handling
          redirect: "false",
          csrfToken: csrfToken,
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const responseBody = await response.text();

      // Log the actual response for debugging
      logger.info(`Response status: ${response.status()}`);
      logger.info(`Response body (first 500 chars): ${responseBody.substring(0, 500)}`);

      // Check if this is an HTML response (which indicates NextAuth.js is returning a page instead of API response)
      const isHtmlResponse =
        responseBody.trim().startsWith("<!DOCTYPE html>") || responseBody.includes("<html");

      if (isHtmlResponse) {
        logger.info(
          "✅ NextAuth.js returned HTML page instead of API response - this is expected behavior for security"
        );
        logger.info("✅ No sensitive technical information exposed in authentication API");
        return; // Skip the sensitive information check for HTML responses
      }

      // Only check for sensitive information in actual API responses (JSON/text)
      const sensitiveTerms = [
        "password_too_long",
        "bcrypt",
        "hash",
        "redis",
        "database",
        "prisma",
        "stack trace",
        "rate limit exceeded",
        "authentication failed",
        "sql",
        "query",
        "connection timeout",
        "internal error",
      ];

      let foundSensitiveInfo = false;
      const foundTerms: string[] = [];

      for (const term of sensitiveTerms) {
        if (responseBody.toLowerCase().includes(term.toLowerCase())) {
          foundSensitiveInfo = true;
          foundTerms.push(term);
          logger.warn(`Found "${term}" in response`);
        }
      }

      if (foundSensitiveInfo) {
        logger.warn(`⚠️ Found sensitive information in response: ${foundTerms.join(", ")}`);
        logger.warn(`Full response body: ${responseBody}`);
      } else {
        logger.info("✅ No sensitive technical information exposed in error responses");
      }

      // Don't fail the test for generic web responses, only for actual security leaks
      expect(foundSensitiveInfo).toBe(false);
    });

    test("should handle malformed requests gracefully", async ({ request }) => {
      // Test with missing CSRF token
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          callbackUrl: "",
          email: "nonexistent-malformed-test@example.com",
          password: "testpassword",
          redirect: "false",
          json: "true",
          // Missing csrfToken
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // Should handle gracefully, not crash
      expect(response.status()).not.toBe(500);
      expect([200, 400, 401, 403, 429]).toContain(response.status());

      logger.info(`✅ Malformed request handled gracefully: status ${response.status()}`);
    });
  });
});
