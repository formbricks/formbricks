import "server-only";
import crypto from "node:crypto";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  AIRTABLE_CLIENT_ID,
  AUDIT_LOG_ENABLED,
  AZURE_OAUTH_ENABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  IS_STORAGE_CONFIGURED,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  OIDC_OAUTH_ENABLED,
  SAML_OAUTH_ENABLED,
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
} from "@/lib/constants";

const CONFIG = {
  QUERY_TIMEOUT_MS: 2000,
  BATCH_TIMEOUT_MS: 5000,
  TOTAL_TIMEOUT_MS: 15000,
} as const;

export type TelemetryUsage = {
  instanceId: string;
  organizationCount: number | null;
  memberCount: number | null;
  teamCount: number | null;
  projectCount: number | null;
  surveyCount: number | null;
  activeSurveyCount: number | null;
  completedSurveyCount: number | null;
  responseCountAllTime: number | null;
  responseCountLast30d: number | null;
  surveyDisplayCount: number | null;
  contactCount: number | null;
  segmentCount: number | null;
  featureUsage: {
    multiLanguageSurveys: boolean | null;
    advancedTargeting: boolean | null;
    sso: boolean | null;
    saml: boolean | null;
    twoFA: boolean | null;
    apiKeys: boolean | null;
    teamRoles: boolean | null;
    auditLogs: boolean | null;
    whitelabel: boolean | null;
    removeBranding: boolean | null;
    fileUpload: boolean | null;
    spamProtection: boolean | null;
    quotas: boolean | null;
  };
  activeIntegrations: {
    airtable: boolean | null;
    slack: boolean | null;
    notion: boolean | null;
    googleSheets: boolean | null;
    zapier: boolean | null;
    make: boolean | null;
    n8n: boolean | null;
    webhook: boolean | null;
  };
  temporal: {
    instanceCreatedAt: string | null;
    newestSurveyDate: string | null;
  };
};

export type TelemetryData = {
  licenseKey: string | null;
  usage: TelemetryUsage | null;
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  return Promise.race([
    promise,
    new Promise<T | null>((resolve) => {
      setTimeout(() => {
        logger.warn({ timeoutMs }, "Query timeout exceeded");
        resolve(null);
      }, timeoutMs);
    }),
  ]);
};

const safeQuery = async <T>(
  queryFn: () => Promise<T>,
  queryName: string,
  batchNumber: number
): Promise<T | null> => {
  try {
    const result = await withTimeout(queryFn(), CONFIG.QUERY_TIMEOUT_MS);
    return result;
  } catch (error) {
    logger.error(
      {
        error,
        queryName,
        batchNumber,
      },
      `Telemetry query failed: ${queryName}`
    );
    return null;
  }
};

const getInstanceId = async (): Promise<string> => {
  try {
    const firstOrg = await withTimeout(
      prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      CONFIG.QUERY_TIMEOUT_MS
    );

    if (!firstOrg) {
      return crypto.randomUUID();
    }

    return crypto.createHash("sha256").update(firstOrg.id).digest("hex").substring(0, 32);
  } catch (error) {
    logger.error({ error }, "Failed to get instance ID, using random UUID");
    return crypto.randomUUID();
  }
};

const collectBatch1 = async (): Promise<Partial<TelemetryUsage>> => {
  const queries = [
    {
      name: "organizationCount",
      fn: () => prisma.organization.count(),
    },
    {
      name: "memberCount",
      fn: () => prisma.user.count(),
    },
    {
      name: "teamCount",
      fn: () => prisma.team.count(),
    },
    {
      name: "projectCount",
      fn: () => prisma.project.count(),
    },
    {
      name: "surveyCount",
      fn: () => prisma.survey.count(),
    },
    {
      name: "contactCount",
      fn: () => prisma.contact.count(),
    },
    {
      name: "segmentCount",
      fn: () => prisma.segment.count(),
    },
    {
      name: "surveyDisplayCount",
      fn: () => prisma.display.count(),
    },
    {
      name: "responseCountAllTime",
      fn: () => prisma.response.count(),
    },
  ];

  const results = await Promise.allSettled(queries.map((query) => safeQuery(query.fn, query.name, 1)));

  const batchResult: Partial<TelemetryUsage> = {};
  for (const [index, result] of results.entries()) {
    const key = queries[index].name as keyof TelemetryUsage;
    if (result.status === "fulfilled" && result.value !== null) {
      (batchResult as Record<string, unknown>)[key] = result.value;
    } else {
      (batchResult as Record<string, unknown>)[key] = null;
    }
  }

  return batchResult;
};

const collectBatch2 = async (): Promise<Partial<TelemetryUsage>> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const queries = [
    {
      name: "activeSurveyCount",
      fn: () => prisma.survey.count({ where: { status: "inProgress" } }),
    },
    {
      name: "completedSurveyCount",
      fn: () => prisma.survey.count({ where: { status: "completed" } }),
    },
    {
      name: "responseCountLast30d",
      fn: () =>
        prisma.response.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
    },
  ];

  const results = await Promise.allSettled(queries.map((query) => safeQuery(query.fn, query.name, 2)));

  const batchResult: Partial<TelemetryUsage> = {};
  for (const [index, result] of results.entries()) {
    const key = queries[index].name as keyof TelemetryUsage;
    if (result.status === "fulfilled" && result.value !== null) {
      (batchResult as Record<string, unknown>)[key] = result.value;
    } else {
      (batchResult as Record<string, unknown>)[key] = null;
    }
  }

  return batchResult;
};

const collectBatch3 = async (): Promise<Partial<TelemetryUsage>> => {
  const queries = [
    {
      name: "multiLanguageSurveys",
      fn: async () => {
        const result = await prisma.surveyLanguage.findFirst({ select: { languageId: true } });
        return result !== null;
      },
    },
    {
      name: "advancedTargeting",
      fn: async () => {
        const [hasFilters, hasSegments] = await Promise.all([
          prisma.surveyAttributeFilter.findFirst({ select: { id: true } }),
          prisma.survey.findFirst({ where: { segmentId: { not: null } } }),
        ]);
        return hasFilters !== null || hasSegments !== null;
      },
    },
    {
      name: "twoFA",
      fn: async () => {
        const result = await prisma.user.findFirst({
          where: { twoFactorEnabled: true },
          select: { id: true },
        });
        return result !== null;
      },
    },
    {
      name: "apiKeys",
      fn: async () => {
        const result = await prisma.apiKey.findFirst({ select: { id: true } });
        return result !== null;
      },
    },
    {
      name: "teamRoles",
      fn: async () => {
        const result = await prisma.teamUser.findFirst({ select: { teamId: true } });
        return result !== null;
      },
    },
    {
      name: "whitelabel",
      fn: async () => {
        const organizations = await prisma.organization.findMany({
          select: { whitelabel: true },
          take: 100,
        });
        return organizations.some((org) => {
          const whitelabel = org.whitelabel as Record<string, unknown> | null;
          return whitelabel !== null && typeof whitelabel === "object" && Object.keys(whitelabel).length > 0;
        });
      },
    },
    {
      name: "removeBranding",
      fn: async () => {
        const organizations = await prisma.organization.findMany({
          select: { billing: true },
          take: 100,
        });
        return organizations.some((org) => {
          const billing = org.billing as { plan?: string; removeBranding?: boolean } | null;
          return billing?.removeBranding === true;
        });
      },
    },
    {
      name: "quotas",
      fn: async () => {
        const result = await prisma.surveyQuota.findFirst({ select: { id: true } });
        return result !== null;
      },
    },
  ];

  const results = await Promise.allSettled(queries.map((query) => safeQuery(query.fn, query.name, 3)));

  const batchResult: Partial<TelemetryUsage> = {
    featureUsage: {
      multiLanguageSurveys: null,
      advancedTargeting: null,
      sso: null,
      saml: null,
      twoFA: null,
      apiKeys: null,
      teamRoles: null,
      auditLogs: null,
      whitelabel: null,
      removeBranding: null,
      fileUpload: null,
      spamProtection: null,
      quotas: null,
    },
  };

  const featureMap: Record<string, keyof TelemetryUsage["featureUsage"]> = {
    multiLanguageSurveys: "multiLanguageSurveys",
    advancedTargeting: "advancedTargeting",
    twoFA: "twoFA",
    apiKeys: "apiKeys",
    teamRoles: "teamRoles",
    whitelabel: "whitelabel",
    removeBranding: "removeBranding",
    quotas: "quotas",
  };

  for (const [index, result] of results.entries()) {
    const queryName = queries[index].name;
    const featureKey = featureMap[queryName];
    if (featureKey && batchResult.featureUsage) {
      if (result.status === "fulfilled" && result.value !== null) {
        batchResult.featureUsage[featureKey] = result.value;
      } else {
        batchResult.featureUsage[featureKey] = null;
      }
    }
  }

  if (batchResult.featureUsage) {
    batchResult.featureUsage.sso =
      GOOGLE_OAUTH_ENABLED ||
      GITHUB_OAUTH_ENABLED ||
      AZURE_OAUTH_ENABLED ||
      OIDC_OAUTH_ENABLED ||
      SAML_OAUTH_ENABLED;
    batchResult.featureUsage.saml = SAML_OAUTH_ENABLED;
    batchResult.featureUsage.auditLogs = AUDIT_LOG_ENABLED;
    batchResult.featureUsage.fileUpload = IS_STORAGE_CONFIGURED;
    batchResult.featureUsage.spamProtection = IS_RECAPTCHA_CONFIGURED;
  }

  return batchResult;
};

const collectBatch4 = async (): Promise<Partial<TelemetryUsage>> => {
  const booleanQueries = [
    {
      name: "zapier",
      fn: async (): Promise<boolean> => {
        const result = await prisma.webhook.findFirst({
          where: { source: "zapier" },
          select: { id: true },
        });
        return result !== null;
      },
    },
    {
      name: "make",
      fn: async (): Promise<boolean> => {
        const result = await prisma.webhook.findFirst({
          where: { source: "make" },
          select: { id: true },
        });
        return result !== null;
      },
    },
    {
      name: "n8n",
      fn: async (): Promise<boolean> => {
        const result = await prisma.webhook.findFirst({
          where: { source: "n8n" },
          select: { id: true },
        });
        return result !== null;
      },
    },
    {
      name: "webhook",
      fn: async (): Promise<boolean> => {
        const result = await prisma.webhook.findFirst({
          where: { source: "user" },
          select: { id: true },
        });
        return result !== null;
      },
    },
  ];

  const stringQueries = [
    {
      name: "instanceCreatedAt",
      fn: async (): Promise<string | null> => {
        const result = await prisma.user.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        return result?.createdAt.toISOString() ?? null;
      },
    },
    {
      name: "newestSurveyDate",
      fn: async (): Promise<string | null> => {
        const result = await prisma.survey.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        return result?.createdAt.toISOString() ?? null;
      },
    },
  ];

  const booleanResults = await Promise.allSettled(
    booleanQueries.map((query) => safeQuery(query.fn, query.name, 4))
  );
  const stringResults = await Promise.allSettled(
    stringQueries.map((query) => safeQuery(query.fn, query.name, 4))
  );

  const batchResult: Partial<TelemetryUsage> = {
    activeIntegrations: {
      airtable: null,
      slack: null,
      notion: null,
      googleSheets: null,
      zapier: null,
      make: null,
      n8n: null,
      webhook: null,
    },
    temporal: {
      instanceCreatedAt: null,
      newestSurveyDate: null,
    },
  };

  const integrationMap: Record<string, keyof TelemetryUsage["activeIntegrations"]> = {
    zapier: "zapier",
    make: "make",
    n8n: "n8n",
    webhook: "webhook",
  };

  for (const [index, result] of booleanResults.entries()) {
    const queryName = booleanQueries[index].name;
    const integrationKey = integrationMap[queryName];
    if (integrationKey && batchResult.activeIntegrations) {
      if (result.status === "fulfilled" && result.value !== null) {
        batchResult.activeIntegrations[integrationKey] = result.value;
      } else {
        batchResult.activeIntegrations[integrationKey] = null;
      }
    }
  }

  for (const [index, result] of stringResults.entries()) {
    const queryName = stringQueries[index].name;
    if (batchResult.temporal && (queryName === "instanceCreatedAt" || queryName === "newestSurveyDate")) {
      if (result.status === "fulfilled" && result.value !== null) {
        batchResult.temporal[queryName] = result.value;
      }
    }
  }

  if (batchResult.activeIntegrations) {
    batchResult.activeIntegrations.airtable = !!AIRTABLE_CLIENT_ID;
    batchResult.activeIntegrations.slack = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
    batchResult.activeIntegrations.notion = !!(NOTION_OAUTH_CLIENT_ID && NOTION_OAUTH_CLIENT_SECRET);
    batchResult.activeIntegrations.googleSheets = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET);
  }

  return batchResult;
};

export const collectTelemetryData = async (licenseKey: string | null): Promise<TelemetryData> => {
  if (IS_FORMBRICKS_CLOUD) {
    return {
      licenseKey,
      usage: null,
    };
  }

  const startTime = Date.now();

  try {
    const instanceId = await getInstanceId();

    const batchPromises = [
      Promise.race([
        collectBatch1(),
        new Promise<Partial<TelemetryUsage>>((resolve) => {
          setTimeout(() => {
            logger.warn("Batch 1 timeout");
            resolve({});
          }, CONFIG.BATCH_TIMEOUT_MS);
        }),
      ]),
      Promise.race([
        collectBatch2(),
        new Promise<Partial<TelemetryUsage>>((resolve) => {
          setTimeout(() => {
            logger.warn("Batch 2 timeout");
            resolve({});
          }, CONFIG.BATCH_TIMEOUT_MS);
        }),
      ]),
      Promise.race([
        collectBatch3(),
        new Promise<Partial<TelemetryUsage>>((resolve) => {
          setTimeout(() => {
            logger.warn("Batch 3 timeout");
            resolve({});
          }, CONFIG.BATCH_TIMEOUT_MS);
        }),
      ]),
      Promise.race([
        collectBatch4(),
        new Promise<Partial<TelemetryUsage>>((resolve) => {
          setTimeout(() => {
            logger.warn("Batch 4 timeout");
            resolve({});
          }, CONFIG.BATCH_TIMEOUT_MS);
        }),
      ]),
    ];

    const batchResults = await Promise.race([
      Promise.all(batchPromises),
      new Promise<Partial<TelemetryUsage>[]>((resolve) => {
        setTimeout(() => {
          logger.warn("Total telemetry collection timeout");
          resolve([{}, {}, {}, {}]);
        }, CONFIG.TOTAL_TIMEOUT_MS);
      }),
    ]);

    const usage: TelemetryUsage = {
      instanceId,
      organizationCount: null,
      memberCount: null,
      teamCount: null,
      projectCount: null,
      surveyCount: null,
      activeSurveyCount: null,
      completedSurveyCount: null,
      responseCountAllTime: null,
      responseCountLast30d: null,
      surveyDisplayCount: null,
      contactCount: null,
      segmentCount: null,
      featureUsage: {
        multiLanguageSurveys: null,
        advancedTargeting: null,
        sso: null,
        saml: null,
        twoFA: null,
        apiKeys: null,
        teamRoles: null,
        auditLogs: null,
        whitelabel: null,
        removeBranding: null,
        fileUpload: null,
        spamProtection: null,
        quotas: null,
      },
      activeIntegrations: {
        airtable: null,
        slack: null,
        notion: null,
        googleSheets: null,
        zapier: null,
        make: null,
        n8n: null,
        webhook: null,
      },
      temporal: {
        instanceCreatedAt: null,
        newestSurveyDate: null,
      },
    };

    for (const batchResult of batchResults) {
      Object.assign(usage, batchResult);
      if (batchResult.featureUsage) {
        Object.assign(usage.featureUsage, batchResult.featureUsage);
      }
      if (batchResult.activeIntegrations) {
        Object.assign(usage.activeIntegrations, batchResult.activeIntegrations);
      }
      if (batchResult.temporal) {
        Object.assign(usage.temporal, batchResult.temporal);
      }
    }

    const duration = Date.now() - startTime;
    logger.info({ duration, instanceId }, "Telemetry collection completed");

    return {
      licenseKey,
      usage,
    };
  } catch (error) {
    logger.error({ error, duration: Date.now() - startTime }, "Telemetry collection failed completely");
    return {
      licenseKey,
      usage: null,
    };
  }
};
