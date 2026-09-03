import { type CacheService, createCacheKey, getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { IntegrationType } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { E2E_TESTING, IS_DEVELOPMENT, TELEMETRY_DISABLED } from "@/lib/constants";
import { env } from "@/lib/env";
import { hashString } from "@/lib/hash-string";
import { getInstanceInfo } from "@/lib/instance";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import packageJson from "@/package.json";

const TELEMETRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_LOCK_KEY = createCacheKey.custom("analytics", "telemetry_lock");
const TELEMETRY_LAST_SENT_KEY = createCacheKey.custom("analytics", "telemetry_last_sent_ts");

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
 *
 * Called from two places, both of which rely on those checks for idempotency: the response pipeline
 * (so an active instance reports as it is used) and the daily usage telemetry job (so an instance that
 * collects no responses still reports at least once — see ENG-2107).
 */
// Hashed license key for log context — allows correlating log entries to a specific license
// without exposing the raw key. Computed once at module load.
const hashedLicenseKey = env.ENTERPRISE_LICENSE_KEY ? hashString(env.ENTERPRISE_LICENSE_KEY) : null;

/**
 * Returns true if telemetry is disabled via env var AND there is no active EE license.
 * EE customers cannot opt out — telemetry is always enforced for license compliance.
 */
const isTelemetryDisabledForCE = async (): Promise<boolean> => {
  if (!TELEMETRY_DISABLED) return false;
  const license = await getEnterpriseLicense();
  return !license.active;
};

/**
 * Runs the actual send once every check has passed and the lock is held. Pulled out of
 * `sendTelemetryEvents` so its try/catch/finally isn't nested inside that function's own try block —
 * nesting is what pushed the caller over the cognitive-complexity threshold, not the branch count.
 */
const executeTelemetrySend = async (cache: CacheService, lastSent: number, now: number): Promise<void> => {
  try {
    const sent = await sendTelemetry(lastSent);

    if (!sent) {
      // Nothing was reported (no organization exists yet), so the 24h window must not be consumed:
      // recording it here would delay the instance's *first* usage update by a day.
      //
      // The 1h value is a floor on the next attempt, not a scheduled retry — nothing re-invokes this
      // hourly. It exists so the next real trigger is not blocked for 24h; those triggers are a
      // processed response, the next 02:15 UTC tick, or that tick running overdue at the next boot.
      // So on an instance with no response traffic the first usage update after an organization is
      // created lands within a day, not within an hour.
      logger.info(
        { hashedLicenseKey },
        "Telemetry skipped - no organization to report on yet, not consuming the 24h window"
      );
      nextTelemetryCheck = now + 60 * 60 * 1000;
      return;
    }

    // Success: Update Redis with current timestamp so other instances know telemetry was sent.
    // No TTL - persists indefinitely to support low-volume instances (responses every few days/weeks).
    await cache.set(TELEMETRY_LAST_SENT_KEY, now.toString());

    // Update in-memory check to prevent this instance from checking again for 24h.
    nextTelemetryCheck = now + TELEMETRY_INTERVAL_MS;
  } catch (e) {
    // Log as warning since telemetry is non-essential
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.warn(
      { error: e, message: errorMessage, lastSent, now, hashedLicenseKey },
      "Failed to send telemetry - applying 1h cooldown"
    );

    // Failure cooldown: Prevent retrying immediately to avoid hammering the endpoint.
    // Wait 1 hour before allowing this instance to try again. Like the no-organization case above
    // this is a floor rather than a retry — the next attempt is whenever a trigger next calls in.
    // Note: Other instances can still try (they'll hit the lock or Redis check).
    nextTelemetryCheck = now + 60 * 60 * 1000;
  } finally {
    // Always release the lock, even if telemetry failed.
    // This allows other instances to retry if this one failed.
    await cache.del([TELEMETRY_LOCK_KEY]);
  }
};

export const sendTelemetryEvents = async () => {
  try {
    // ============================================================
    // CHECK 0: Non-Production Hard Skip
    // ============================================================
    // Purpose: Unconditionally skip telemetry in dev and test/CI environments.
    // No EE bypass — these are internal flags, not customer-facing.
    if (E2E_TESTING || IS_DEVELOPMENT) {
      return;
    }

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
    // CHECK 2: Telemetry Disabled Check
    // ============================================================
    // Purpose: Allow CE self-hosters to opt out of telemetry via env var.
    // EE bypass: If an active Enterprise License is detected, telemetry is always sent
    // regardless of the TELEMETRY_DISABLED setting to enforce license compliance.
    // Placed after in-memory check to avoid calling getEnterpriseLicense() on every invocation.
    if (await isTelemetryDisabledForCE()) {
      return;
    }

    // ============================================================
    // CHECK 3: Redis Check (Shared State)
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
    // CHECK 4: Distributed Lock (Prevent Concurrent Execution)
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
    await executeTelemetrySend(cache, lastSent, now);
  } catch (error) {
    // Catch-all for any unexpected errors in the wrapper logic (cache failures, lock issues, etc.)
    // Log as warning since telemetry is non-essential functionality
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      { error, message: errorMessage, timestamp: Date.now(), hashedLicenseKey },
      "Unexpected error in sendTelemetryEvents wrapper - telemetry check skipped"
    );
  }
};

/**
 * Distinct trigger and step types across the instance's live workflows, read straight from the JSONB
 * definitions so a new node kind reports itself. Fail-soft on purpose: this is a nice-to-have on top
 * of the counts, and a malformed definition must not cost the instance its whole usage report.
 */
const getWorkflowNodeTypesInUse = async (): Promise<{ triggerTypes: string[]; actionTypes: string[] }> => {
  try {
    const [row] = await prisma.$queryRaw<[{ triggerTypes: unknown; actionTypes: unknown }]>`
      SELECT
        COALESCE(
          (SELECT array_agg(DISTINCT w."definition"->'trigger'->>'triggerType')
             FROM "Workflow" w
            WHERE w.status <> 'archived' AND w."definition"->'trigger'->>'triggerType' IS NOT NULL),
          ARRAY[]::text[]
        ) as "triggerTypes",
        COALESCE(
          (SELECT array_agg(DISTINCT COALESCE(n->>'actionType', n->>'type'))
             FROM (SELECT "definition" FROM "Workflow"
                    WHERE status <> 'archived' AND jsonb_typeof("definition"->'nodes') = 'array') w,
                  jsonb_array_elements(w."definition"->'nodes') n),
          ARRAY[]::text[]
        ) as "actionTypes"
    `;
    const toStrings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : [];
    return { triggerTypes: toStrings(row?.triggerTypes), actionTypes: toStrings(row?.actionTypes) };
  } catch (error) {
    logger.warn({ error }, "Failed to read workflow node types for the usage update");
    return { triggerTypes: [], actionTypes: [] };
  }
};

/**
 * Gathers telemetry data and sends it to Formbricks Enterprise endpoint.
 * @param lastSent - Timestamp of last telemetry send (used to calculate incremental metrics)
 * @returns `true` when a usage update was accepted by the endpoint, `false` when there was nothing to
 * report. Throws when the update could not be delivered, so the caller applies its failure cooldown
 * instead of recording a send that never happened.
 */
const sendTelemetry = async (lastSent: number): Promise<boolean> => {
  // Get the instance info (hashed oldest organization ID and creation date).
  // Using the oldest org ensures the ID doesn't change over time.
  const instanceInfo = await getInstanceInfo();
  if (!instanceInfo) return false; // No organization exists, nothing to report

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
          workspaceCount: bigint;
          surveyCount: bigint;
          inProgressSurveyCount: bigint;
          completedSurveyCount: bigint;
          responseCountAllTime: bigint;
          responseCountSinceLastUpdate: bigint;
          displayCount: bigint;
          contactCount: bigint;
          segmentCount: bigint;
          newestResponseAt: Date | null;
          workflowCount: bigint;
          enabledWorkflowCount: bigint;
          workflowRunCountSinceLastUpdate: bigint;
          workflowRunFailedCountSinceLastUpdate: bigint;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*) FROM "Organization") as "organizationCount",
        (SELECT COUNT(*) FROM "User") as "userCount",
        (SELECT COUNT(*) FROM "Team") as "teamCount",
        (SELECT COUNT(*) FROM "Workspace") as "workspaceCount",
        (SELECT COUNT(*) FROM "Survey") as "surveyCount",
        (SELECT COUNT(*) FROM "Survey" WHERE status = 'inProgress') as "inProgressSurveyCount",
        (SELECT COUNT(*) FROM "Survey" WHERE status = 'completed') as "completedSurveyCount",
        (SELECT COUNT(*) FROM "Response") as "responseCountAllTime",
        (SELECT COUNT(*) FROM "Response" WHERE "created_at" > ${new Date(lastSent || 0)}) as "responseCountSinceLastUpdate",
        (SELECT COUNT(*) FROM "Display") as "displayCount",
        (SELECT COUNT(*) FROM "Contact") as "contactCount",
        (SELECT COUNT(*) FROM "Segment") as "segmentCount",
        (SELECT MAX("created_at") FROM "Response") as "newestResponseAt",
        (SELECT COUNT(*) FROM "Workflow" WHERE status <> 'archived') as "workflowCount",
        (SELECT COUNT(*) FROM "Workflow" WHERE status = 'enabled') as "enabledWorkflowCount",
        (SELECT COUNT(*) FROM "WorkflowRun" WHERE "isDryRun" = false AND "created_at" > ${new Date(lastSent || 0)}) as "workflowRunCountSinceLastUpdate",
        (SELECT COUNT(*) FROM "WorkflowRun" WHERE "isDryRun" = false AND status = 'failed' AND "created_at" > ${new Date(lastSent || 0)}) as "workflowRunFailedCountSinceLastUpdate"
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
  const workspaceCount = Number(counts.workspaceCount);
  const surveyCount = Number(counts.surveyCount);
  const inProgressSurveyCount = Number(counts.inProgressSurveyCount);
  const completedSurveyCount = Number(counts.completedSurveyCount);
  const responseCountAllTime = Number(counts.responseCountAllTime);
  const responseCountSinceLastUpdate = Number(counts.responseCountSinceLastUpdate);
  const displayCount = Number(counts.displayCount);
  const contactCount = Number(counts.contactCount);
  const segmentCount = Number(counts.segmentCount);
  const newestResponse = counts.newestResponseAt ? { createdAt: counts.newestResponseAt } : null;
  const workflowNodeTypes = await getWorkflowNodeTypesInUse();

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
    saml: !!env.SAML_DATABASE_URL || ssoProviders.some((p) => p.provider === "saml"),
  };

  // Construct telemetry payload with usage statistics and configuration.
  const payload = {
    schemaVersion: 1, // Schema version for future compatibility
    // Core entity counts
    organizationCount,
    userCount,
    teamCount,
    workspaceCount,
    surveyCount,
    inProgressSurveyCount,
    completedSurveyCount,
    // Response metrics
    responseCountAllTime,
    responseCountSinceLastUsageUpdate: responseCountSinceLastUpdate, // Incremental since last telemetry
    displayCount,
    contactCount,
    segmentCount,
    // Workflows adoption for self-hosted instances, which send nothing to PostHog (ENG-2851).
    workflows: {
      workflowCount: Number(counts.workflowCount),
      enabledWorkflowCount: Number(counts.enabledWorkflowCount),
      runCountSinceLastUsageUpdate: Number(counts.workflowRunCountSinceLastUpdate),
      failedRunCountSinceLastUsageUpdate: Number(counts.workflowRunFailedCountSinceLastUpdate),
      ...workflowNodeTypes,
    },
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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // A rejected update must not be recorded as sent, or the instance stays silent for another 24h
    // while the license server still has no usage for it.
    if (!res.ok) {
      throw new Error(`Usage update endpoint responded with status ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }

  return true;
};
