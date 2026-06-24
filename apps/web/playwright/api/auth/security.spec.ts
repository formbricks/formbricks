import { expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "../../lib/fixtures";

// Better Auth credential sign-in endpoint (ENG-1054 cutover). The NextAuth `/api/auth/csrf` +
// `/api/auth/callback/credentials` flow was deleted with the `[...nextauth]` route, so these tests
// drive Better Auth's `POST /api/auth/sign-in/email` (JSON body, no CSRF token) instead. The
// endpoint is hardcoded to avoid import issues.
const SIGN_IN_ENDPOINT = "/api/auth/sign-in/email";

test.describe("Authentication Security Tests - Vulnerability Prevention", () => {
  let testUser: { email: string; password: string };

  test.beforeEach(async ({ users }) => {
    // Create a test user for "existing user" scenarios with unique email. The fixture creates a real
    // Better Auth credential account (provider "credential") using the user NAME as the password, so
    // this user can sign in via `POST /api/auth/sign-in/email`.
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
      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          email: email,
          password: extremelyLongPassword,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseTime = Date.now() - start;

      // Should not crash the server (no 500 errors)
      expect(response.status()).not.toBe(500);

      // Better Auth's maxPasswordLength (128) rejects this before hashing — never a successful sign-in.
      expect(response.status()).not.toBe(200);
      expect([400, 401, 422, 429]).toContain(response.status());

      // No session must be issued for a rejected over-length sign-in.
      expect(response.headers()["set-cookie"]).toBeUndefined();

      logger.info(
        `Extremely long password (50k chars) processing time: ${responseTime}ms, status: ${response.status()}`
      );

      // Verify the DoS protection is working: an over-length password is rejected promptly by Better
      // Auth's length check (it never reaches the expensive bcrypt verify). Keep the timing assertion.
      // The test environment has overhead, so allow generous headroom while still catching a hang/crash.
      expect(responseTime).toBeLessThan(5000);

      if (responseTime < 5000) {
        logger.info("✅ Long password rejected quickly - DoS protection working");
      } else {
        logger.warn("⚠️ Long password took longer than expected - check DoS protection");
      }
    });

    test("should handle password at 128 character limit", async ({ request }) => {
      const email = "nonexistent-limit-test@example.com"; // Use non-existent email for limit test
      const maxLengthPassword = "A".repeat(128); // Exactly at the 128 character limit

      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          email: email,
          password: maxLengthPassword,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      // A 128-char password is within Better Auth's maxPasswordLength, so it is NOT rejected for length.
      // It follows the normal credential path and fails as invalid credentials for a non-existent user
      // (401) — crucially not a length/422 rejection and not a 500.
      expect(response.status()).not.toBe(500);
      expect([400, 401, 429]).toContain(response.status());

      logger.info(`Max length password (128 chars) status: ${response.status()}`);
    });

    test("should reject passwords over 128 characters", async ({ request }) => {
      const email = "nonexistent-overlimit-test@example.com"; // Use non-existent email for over-limit test
      const overLimitPassword = "A".repeat(10000); // 10,000 characters (over limit)

      const start = Date.now();
      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          email: email,
          password: overLimitPassword,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseTime = Date.now() - start;

      // Should not crash, and must be rejected (Better Auth's maxPasswordLength) — never a session.
      expect(response.status()).not.toBe(500);
      expect(response.status()).not.toBe(200);
      expect(response.headers()["set-cookie"]).toBeUndefined();

      logger.info(
        `Over-limit password (10k chars) processing time: ${responseTime}ms, status: ${response.status()}`
      );

      // The key security test: an over-limit password is rejected by the length check, so it must not
      // take exponentially longer than a short password (no bcrypt on the rejected input). DoS protection.
      expect(responseTime).toBeLessThan(5000);
    });
  });

  test.describe("Timing Attack Prevention - User Enumeration Protection", () => {
    test("should not reveal user existence through response timing differences", async ({ request }) => {
      // Sub-100ms enumeration-timing differences can't be measured meaningfully through Playwright
      // service mode's remote-browser tunnel — tunnel network jitter dwarfs the signal and makes the
      // assertion flaky. Keep it running in local mode, where the measurement is valid.
      // (PLAYWRIGHT_SERVICE_URL is the Azure Playwright service endpoint — present only in service mode.)
      test.skip(
        Boolean(process.env.PLAYWRIGHT_SERVICE_URL),
        "Timing-attack measurement is unreliable through the service-mode remote-browser tunnel."
      );
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
        await request.post(SIGN_IN_ENDPOINT, {
          data: {
            email: `warmup-nonexistent-${i}@example.com`,
            password: "warmuppassword",
          },
          headers: {
            "Content-Type": "application/json",
          },
        });

        await request.post(SIGN_IN_ENDPOINT, {
          data: {
            email: testUser.email,
            password: "wrongwarmuppassword",
          },
          headers: {
            "Content-Type": "application/json",
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
        const responseNonExistent = await request.post(SIGN_IN_ENDPOINT, {
          data: {
            email: `nonexistent-timing-${i}@example.com`,
            password: "somepassword",
          },
          headers: {
            "Content-Type": "application/json",
          },
        });
        const endNonExistent = process.hrtime.bigint();
        const responseTimeNonExistent = Number(endNonExistent - startNonExistent) / 1000000;
        nonExistentTimes.push(responseTimeNonExistent);
        expect(responseNonExistent.status()).not.toBe(500);

        // Test existing user (interleaved)
        const startExisting = process.hrtime.bigint();
        const responseExisting = await request.post(SIGN_IN_ENDPOINT, {
          data: {
            email: testUser.email,
            password: "wrongpassword123",
          },
          headers: {
            "Content-Type": "application/json",
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
        const response = await request.post(SIGN_IN_ENDPOINT, {
          data: {
            email: scenario.email,
            password: scenario.password,
          },
          headers: {
            "Content-Type": "application/json",
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

      // CRITICAL: Both scenarios should return the same status code. Better Auth answers both the
      // unknown-email and the wrong-password case with the same INVALID_EMAIL_OR_PASSWORD / 401, so a
      // different status code per scenario would reveal user existence (enumeration).
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
      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          email: "nonexistent-headers-test@example.com",
          password: "testpassword",
        },
        headers: {
          "Content-Type": "application/json",
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
      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          email: "nonexistent-disclosure-test@example.com",
          password: "A".repeat(10000), // Trigger long password handling
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseBody = await response.text();

      // Log the actual response for debugging
      logger.info(`Response status: ${response.status()}`);
      logger.info(`Response body (first 500 chars): ${responseBody.substring(0, 500)}`);

      // Better Auth returns a generic JSON error and must not leak internals or which auth factor
      // failed (the latter would enable user enumeration).
      const sensitiveTerms = [
        "bcrypt",
        "hash",
        "redis",
        "database",
        "prisma",
        "stack trace",
        "rate limit exceeded",
        "sql",
        "query",
        "connection timeout",
        "internal error",
        // Factor-disclosure terms: the error must not reveal whether the email or the password was wrong.
        "user not found",
        "no user",
        "email not found",
        "incorrect password",
        "wrong password",
        "invalid password",
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

      expect(foundSensitiveInfo).toBe(false);
    });

    test("should handle malformed requests gracefully", async ({ request }) => {
      // removed: NextAuth CSRF flow no longer exists post-ENG-1054. Better Auth's sign-in has no CSRF
      // token, so the original "missing csrfToken" case is meaningless. Convert it to the equivalent
      // Better Auth input-robustness property: a malformed body must be handled gracefully (no crash,
      // no session), not produce a 500.
      const response = await request.post(SIGN_IN_ENDPOINT, {
        data: {
          // Missing the required `password` field entirely (malformed credential payload).
          email: "nonexistent-malformed-test@example.com",
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Should handle gracefully, not crash, and never issue a session for a malformed request.
      expect(response.status()).not.toBe(500);
      expect(response.status()).not.toBe(200);
      expect([400, 401, 403, 422, 429]).toContain(response.status());
      expect(response.headers()["set-cookie"]).toBeUndefined();

      logger.info(`✅ Malformed request handled gracefully: status ${response.status()}`);
    });

    test("should invalidate a copied session cookie after logout", async ({
      page,
      browser,
      request,
      users,
    }) => {
      const user = await users.create();
      await user.login();

      // Better Auth's signed session cookie is `formbricks.session_token` (or the browser-enforced
      // `__Secure-` prefix on HTTPS); replaces the NextAuth `next-auth.session-token` cookie (ENG-1054).
      const sessionCookie = (await page.context().cookies()).find((cookie) =>
        cookie.name.includes("session_token")
      );

      expect(sessionCookie).toBeDefined();

      const preLogoutContext = await browser.newContext();
      try {
        await preLogoutContext.addCookies([sessionCookie!]);
        const preLogoutPage = await preLogoutContext.newPage();
        await preLogoutPage.goto("http://localhost:3000/environments");
        await expect(preLogoutPage).not.toHaveURL(/\/auth\/login/);
      } finally {
        await preLogoutContext.close();
      }

      // Better Auth sign-out: `POST /api/auth/sign-out` (replaces the NextAuth `/api/auth/signout` +
      // csrfToken form flow; ENG-1054). Three things are load-bearing — confirmed from the failing-run
      // trace + the BA source:
      //  - explicit `cookie` header — the login fixture sets the session via the APIRequestContext, and
      //    in Playwright service mode that cookie isn't mirrored into the remote browser's jar, so we
      //    attach the captured cookie directly. Deterministic in both local and service mode.
      //  - `data: {}` — the Next.js route handler (toNextJsHandler) rejects a body-less POST with 415
      //    Unsupported Media Type; an object body makes Playwright send `content-type: application/json`
      //    (same as the sign-in call above).
      //  - `origin` header — BA's CSRF guard (origin-check.mjs) validates Origin on any auth request
      //    that carries a cookie; without it the (cookie-bearing) sign-out is 403. The app origin is a
      //    trusted origin (auth.ts `trustedOrigins` = BETTER_AUTH_URL/NEXTAUTH_URL = the baseURL).
      const signOutResponse = await request.post("/api/auth/sign-out", {
        headers: {
          cookie: `${sessionCookie!.name}=${sessionCookie!.value}`,
          origin: "http://localhost:3000",
        },
        data: {},
      });

      // Require 2xx, not merely "not 500": a 415/4xx here means the sign-out never ran — which a weaker
      // check silently passes while the session (and the replay below) stays valid.
      expect(signOutResponse.ok()).toBeTruthy();

      const replayContext = await browser.newContext();
      try {
        await replayContext.addCookies([sessionCookie!]);
        const replayPage = await replayContext.newPage();
        await replayPage.goto("http://localhost:3000/environments");
        await expect(replayPage).toHaveURL(/\/auth\/login/);
      } finally {
        await replayContext.close();
      }
    });
  });
});
