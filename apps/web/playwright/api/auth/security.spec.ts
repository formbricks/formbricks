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
    // Cost 12 is production's: the sign-in endpoint hashes a dummy password at that cost for unknown
    // emails, so a cheaper stored hash would make existing users look ~4x faster than unknown ones.
    await users.create({
      name: userName,
      email: userEmail,
      passwordCost: 12,
    });
    testUser = {
      email: userEmail,
      password: userName, // The fixture uses the name as password
    };
  });

  test.describe("Timing Attack Prevention - User Enumeration Protection", () => {
    test("should not reveal user existence through response timing differences @timing", async ({
      request,
    }) => {
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

    test("should invalidate a copied session cookie after logout", async ({
      page,
      browser,
      request,
      users,
      baseURL,
    }) => {
      const user = await users.create();
      await user.login();
      // A page only a signed-in member can open: with a dead session, the proxy sends it to login.
      const protectedUrl = new URL(`/workspaces/${user.workspaceId}/surveys`, baseURL).toString();

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
        await preLogoutPage.goto(protectedUrl);
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
          origin: new URL(baseURL!).origin,
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
        await replayPage.goto(protectedUrl);
        await expect(replayPage).toHaveURL(/\/auth\/login/);
      } finally {
        await replayContext.close();
      }
    });
  });
});
