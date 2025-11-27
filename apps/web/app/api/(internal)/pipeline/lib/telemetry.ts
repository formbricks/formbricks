import { IntegrationType } from "@prisma/client";
import { createHash } from "node:crypto";
import { type CacheKey, getCacheService } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import packageJson from "../../../../../package.json";

const TELEMETRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_LOCK_KEY = "telemetry_lock" as CacheKey;
const TELEMETRY_LAST_SENT_KEY = "telemetry_last_sent_ts" as CacheKey;

let nextTelemetryCheck = 0;

export const sendTelemetryEvents = async () => {
  try {
    const now = Date.now();
    // 1. In-memory check
    if (now < nextTelemetryCheck) {
      return;
    }

    // 2. Redis check
    const cacheServiceResult = await getCacheService();
    if (!cacheServiceResult.ok) {
      // Fallback: update next check to try again in 1 hour if cache fails, to avoid spamming
      nextTelemetryCheck = now + 60 * 60 * 1000;
      return;
    }
    const cache = cacheServiceResult.data;

    const lastSentResult = await cache.get(TELEMETRY_LAST_SENT_KEY);
    const lastSentStr = lastSentResult.ok && lastSentResult.data ? (lastSentResult.data as string) : null;
    const lastSent = lastSentStr ? Number.parseInt(lastSentStr, 10) : 0;

    if (now - lastSent < TELEMETRY_INTERVAL_MS) {
      // Update in-memory check to match the remaining time
      nextTelemetryCheck = lastSent + TELEMETRY_INTERVAL_MS;
      return;
    }

    // 3. Acquire Lock to prevent concurrent execution in cluster
    const redis = cache.getRedisClient();
    if (!redis) {
      return;
    }

    const acquired = await redis.set(TELEMETRY_LOCK_KEY, "locked", {
      NX: true,
      PX: 5 * 60 * 1000, // 5 minutes
    });

    if (!acquired) {
      return; // If locked by another instance
    }

    try {
      await sendTelemetry(lastSent);
      // Update last sent on success (24h)
      await cache.set(TELEMETRY_LAST_SENT_KEY, now.toString(), TELEMETRY_INTERVAL_MS * 2);
      nextTelemetryCheck = now + TELEMETRY_INTERVAL_MS;
    } catch (e) {
      logger.error(e, "Failed to send telemetry");

      // FAILURE COOLDOWN:
      // Prevent retrying immediately. Wait 1 hour before trying again.
      // We update the in-memory check so this instance doesn't retry.
      nextTelemetryCheck = now + 60 * 60 * 1000;
    } finally {
      await redis.del(TELEMETRY_LOCK_KEY);
    }
  } catch (error) {
    logger.error(error, "Error in sendTelemetryEvents wrapper");
  }
};

const sendTelemetry = async (lastSent: number) => {
  // Gather data
  const oldestOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });

  if (!oldestOrg) return; // No organization, nothing to report

  const instanceId = createHash("sha256").update(oldestOrg.id).digest("hex");

  const [
    organizationCount,
    userCount,
    teamCount,
    projectCount,
    surveyCount,
    inProgressSurveyCount,
    completedSurveyCount,
    responseCountAllTime,
    responseCountSinceLastUpdate,
    displayCount,
    contactCount,
    segmentCount,
    integrations,
    ssoProviders,
    newestResponse,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.team.count(),
    prisma.project.count(),
    prisma.survey.count(),
    prisma.survey.count({ where: { status: "inProgress" } }),
    prisma.survey.count({ where: { status: "completed" } }),
    prisma.response.count(),
    prisma.response.count({ where: { createdAt: { gt: new Date(lastSent || 0) } } }),
    prisma.display.count(),
    prisma.contact.count(),
    prisma.segment.count(),
    prisma.integration.findMany({ select: { type: true }, distinct: ["type"] }),
    prisma.account.findMany({ select: { provider: true }, distinct: ["provider"] }),
    prisma.response.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const integrationMap = {
    notion: integrations.some((i) => i.type === IntegrationType.notion),
    googleSheets: integrations.some((i) => i.type === IntegrationType.googleSheets),
    airtable: integrations.some((i) => i.type === IntegrationType.airtable),
    slack: integrations.some((i) => i.type === IntegrationType.slack),
  };

  const ssoMap = {
    github: !!env.GITHUB_ID || ssoProviders.some((p) => p.provider === "github"),
    google: !!env.GOOGLE_CLIENT_ID || ssoProviders.some((p) => p.provider === "google"),
    azureAd: !!env.AZUREAD_CLIENT_ID || ssoProviders.some((p) => p.provider === "azuread"),
    oidc: !!env.OIDC_CLIENT_ID || ssoProviders.some((p) => p.provider === "openid"),
  };

  const payload = {
    schemaVersion: 1,
    organizationCount,
    userCount,
    teamCount,
    projectCount,
    surveyCount,
    inProgressSurveyCount,
    completedSurveyCount,
    responseCountAllTime,
    responseCountSinceLastUsageUpdate: responseCountSinceLastUpdate,
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
      version: packageJson.version,
    },
    temporal: {
      instanceCreatedAt: oldestOrg.createdAt.toISOString(),
      newestResponseAt: newestResponse?.createdAt.toISOString() || null,
    },
  };

  const url = `https://ee.formbricks.com/api/v1/instances/${instanceId}/usage-updates`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
