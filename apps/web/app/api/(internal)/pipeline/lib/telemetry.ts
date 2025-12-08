import { IntegrationType } from "@prisma/client";
import { type CacheKey, getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import { getInstanceInfo } from "@/lib/instance";
import packageJson from "@/package.json";

const TELEMETRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_LOCK_KEY = "telemetry_lock" as CacheKey;
const TELEMETRY_LAST_SENT_KEY = "telemetry_last_sent_ts" as CacheKey;

/**
 * In-memory timestamp for the next telemetry check.
 * This is a fast, process-local check to avoid unnecessary Redis calls.
 * Updated after each check to prevent redundant executions.
 */
let nextTelemetryCheck = 0;

/**
 * Sends telemetry events to Formbricks Enterprise endpoint.
 * Uses a three-layer check system to prevent duplicate submissions:
 * 1. In-memory check (fast, process-local)
 * 2. Redis check (shared across instances, persists across restarts)
 * 3. Distributed lock (prevents concurrent execution in multi-instance deployments)
 */
export const sendTelemetryEvents = async () => {
  try {
    const now = Date.now();

    // ============================================================
    // CHECK 1: In-Memory Check (Fast Path)
    // ============================================================
    // Purpose: Quick process-local check to avoid Redis calls if we recently checked.
    // How it works: If current time is before nextTelemetryCheck, skip entirely.
    // This is updated after each successful check or failure to prevent spam.
    if (now < nextTelemetryCheck) {
      return;
    }

    // ============================================================
    // CHECK 2: Redis Check (Shared State)
    // ============================================================
    // Purpose: Check if telemetry was sent recently by ANY instance (shared across cluster).
    // This persists across restarts and works in multi-instance deployments.

    const cacheServiceResult = await getCacheService();
    if (!cacheServiceResult.ok) {
      // Redis unavailable: Fallback to in-memory cooldown to avoid spamming.
      // Wait 1 hour before trying again. This prevents hammering Redis when it's down.
      nextTelemetryCheck = now + 60 * 60 * 1000;
      return;
    }
    const cache = cacheServiceResult.data;

    // Get the timestamp of when telemetry was last sent (from any instance).
    const lastSentResult = await cache.get(TELEMETRY_LAST_SENT_KEY);
    const lastSentStr = lastSentResult.ok && lastSentResult.data ? (lastSentResult.data as string) : null;
    const lastSent = lastSentStr ? Number.parseInt(lastSentStr, 10) : 0;

    // If less than 24 hours have passed since last telemetry, skip.
    // Update in-memory check to match remaining time for fast-path optimization.
    if (now - lastSent < TELEMETRY_INTERVAL_MS) {
      nextTelemetryCheck = lastSent + TELEMETRY_INTERVAL_MS;
      return;
    }

    // ============================================================
    // CHECK 3: Distributed Lock (Prevent Concurrent Execution)
    // ============================================================
    // Purpose: Ensure only ONE instance executes telemetry at a time in a cluster.
    // How it works:
    //   - Uses Redis SET NX (only set if not exists) for atomic lock acquisition
    //   - Lock expires after 1 minute (TTL) to prevent deadlocks if instance crashes
    //   - If lock exists, another instance is already running telemetry, so we exit
    //   - Lock is released in finally block after telemetry completes or fails
    const lockResult = await cache.tryLock(TELEMETRY_LOCK_KEY, "locked", 60 * 1000); // 1 minute TTL

    if (!lockResult.ok || !lockResult.data) {
      // Lock acquisition failed or already held by another instance.
      // Exit silently - the other instance will handle telemetry.
      // No need to update nextTelemetryCheck here since we didn't execute.
      return;
    }

    // ============================================================
    // EXECUTION: Send Telemetry
    // ============================================================
    // We've passed all checks and acquired the lock. Now execute telemetry.
    try {
      await sendTelemetry(lastSent);

      // Success: Update Redis with current timestamp so other instances know telemetry was sent.
      // No TTL - persists indefinitely to support low-volume instances (responses every few days/weeks).
      await cache.set(TELEMETRY_LAST_SENT_KEY, now.toString());

      // Update in-memory check to prevent this instance from checking again for 24h.
      nextTelemetryCheck = now + TELEMETRY_INTERVAL_MS;
    } catch (e) {
      // Log as warning since telemetry is non-essential
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn(
        { error: e, message: errorMessage, lastSent, now },
        "Failed to send telemetry - applying 1h cooldown"
      );

      // Failure cooldown: Prevent retrying immediately to avoid hammering the endpoint.
      // Wait 1 hour before allowing this instance to try again.
      // Note: Other instances can still try (they'll hit the lock or Redis check).
      nextTelemetryCheck = now + 60 * 60 * 1000;
    } finally {
      // Always release the lock, even if telemetry failed.
      // This allows other instances to retry if this one failed.
      await cache.del([TELEMETRY_LOCK_KEY]);
    }
  } catch (error) {
    // Catch-all for any unexpected errors in the wrapper logic (cache failures, lock issues, etc.)
    // Log as warning since telemetry is non-essential functionality
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      { error, message: errorMessage, timestamp: Date.now() },
      "Unexpected error in sendTelemetryEvents wrapper - telemetry check skipped"
    );
  }
};

/**
 * Gathers telemetry data and sends it to Formbricks Enterprise endpoint.
 * @param lastSent - Timestamp of last telemetry send (used to calculate incremental metrics)
 */
const sendTelemetry = async (lastSent: number) => {
  // Get the instance info (hashed oldest organization ID and creation date).
  // Using the oldest org ensures the ID doesn't change over time.
  const instanceInfo = await getInstanceInfo();
  if (!instanceInfo) return; // No organization exists, nothing to report

  const { instanceId, createdAt: instanceCreatedAt } = instanceInfo;

  // Optimize database queries to reduce connection pool usage:
  // Instead of 15 parallel queries (which could exhaust the connection pool),
  // we batch all count queries into a single raw SQL query.
  // This reduces connection usage from 15 → 3 (batch counts + integrations + accounts).
  const [countsResult, integrations, ssoProviders] = await Promise.all([
    // Single query for all counts (13 metrics in one round-trip)
    prisma.$queryRaw<
      [
        {
          organizationCount: bigint;
          userCount: bigint;
          teamCount: bigint;
          projectCount: bigint;
          surveyCount: bigint;
          inProgressSurveyCount: bigint;
          completedSurveyCount: bigint;
          responseCountAllTime: bigint;
          responseCountSinceLastUpdate: bigint;
          displayCount: bigint;
          contactCount: bigint;
          segmentCount: bigint;
          newestResponseAt: Date | null;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*) FROM "Organization") as "organizationCount",
        (SELECT COUNT(*) FROM "User") as "userCount",
        (SELECT COUNT(*) FROM "Team") as "teamCount",
        (SELECT COUNT(*) FROM "Project") as "projectCount",
        (SELECT COUNT(*) FROM "Survey") as "surveyCount",
        (SELECT COUNT(*) FROM "Survey" WHERE status = 'inProgress') as "inProgressSurveyCount",
        (SELECT COUNT(*) FROM "Survey" WHERE status = 'completed') as "completedSurveyCount",
        (SELECT COUNT(*) FROM "Response") as "responseCountAllTime",
        (SELECT COUNT(*) FROM "Response" WHERE "created_at" > ${new Date(lastSent || 0)}) as "responseCountSinceLastUpdate",
        (SELECT COUNT(*) FROM "Display") as "displayCount",
        (SELECT COUNT(*) FROM "Contact") as "contactCount",
        (SELECT COUNT(*) FROM "Segment") as "segmentCount",
        (SELECT MAX("created_at") FROM "Response") as "newestResponseAt"
    `,
    // Keep these as separate queries since they need DISTINCT which is harder to optimize
    prisma.integration.findMany({ select: { type: true }, distinct: ["type"] }),
    prisma.account.findMany({ select: { provider: true }, distinct: ["provider"] }),
  ]);

  // Extract metrics from the batched query result and convert bigints to numbers
  const counts = countsResult[0];
  const organizationCount = Number(counts.organizationCount);
  const userCount = Number(counts.userCount);
  const teamCount = Number(counts.teamCount);
  const projectCount = Number(counts.projectCount);
  const surveyCount = Number(counts.surveyCount);
  const inProgressSurveyCount = Number(counts.inProgressSurveyCount);
  const completedSurveyCount = Number(counts.completedSurveyCount);
  const responseCountAllTime = Number(counts.responseCountAllTime);
  const responseCountSinceLastUpdate = Number(counts.responseCountSinceLastUpdate);
  const displayCount = Number(counts.displayCount);
  const contactCount = Number(counts.contactCount);
  const segmentCount = Number(counts.segmentCount);
  const newestResponse = counts.newestResponseAt ? { createdAt: counts.newestResponseAt } : null;

  // Convert integration array to boolean map indicating which integrations are configured.
  const integrationMap = {
    notion: integrations.some((i) => i.type === IntegrationType.notion),
    googleSheets: integrations.some((i) => i.type === IntegrationType.googleSheets),
    airtable: integrations.some((i) => i.type === IntegrationType.airtable),
    slack: integrations.some((i) => i.type === IntegrationType.slack),
  };

  // Check SSO configuration: either via environment variables or database records.
  // This detects which SSO providers are available/configured.
  const ssoMap = {
    github: !!env.GITHUB_ID || ssoProviders.some((p) => p.provider === "github"),
    google: !!env.GOOGLE_CLIENT_ID || ssoProviders.some((p) => p.provider === "google"),
    azureAd: !!env.AZUREAD_CLIENT_ID || ssoProviders.some((p) => p.provider === "azuread"),
    oidc: !!env.OIDC_CLIENT_ID || ssoProviders.some((p) => p.provider === "openid"),
  };

  // Construct telemetry payload with usage statistics and configuration.
  const payload = {
    schemaVersion: 1, // Schema version for future compatibility
    // Core entity counts
    organizationCount,
    userCount,
    teamCount,
    projectCount,
    surveyCount,
    inProgressSurveyCount,
    completedSurveyCount,
    // Response metrics
    responseCountAllTime,
    responseCountSinceLastUsageUpdate: responseCountSinceLastUpdate, // Incremental since last telemetry
    displayCount,
    contactCount,
    segmentCount,
    integrations: integrationMap,
    infrastructure: {
      smtp: !!env.SMTP_HOST,
      s3: !!env.S3_BUCKET_NAME,
      prometheus: !!env.PROMETHEUS_ENABLED,
    },
    security: {
      recaptcha: !!(env.RECAPTCHA_SITE_KEY && env.RECAPTCHA_SECRET_KEY),
    },
    sso: ssoMap,
    meta: {
      version: packageJson.version, // Formbricks version for compatibility tracking
    },
    temporal: {
      instanceCreatedAt: instanceCreatedAt.toISOString(), // When instance was first created
      newestResponseAt: newestResponse?.createdAt.toISOString() || null, // Most recent activity
    },
  };

  // Send telemetry to Formbricks Enterprise endpoint.
  // This endpoint collects usage statistics for enterprise license validation and analytics.
  const url = `https://ee.formbricks.com/api/v1/instances/${instanceId}/usage-updates`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeout);
};
