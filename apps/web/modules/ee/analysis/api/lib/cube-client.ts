import "server-only";
import cubejs, { type Query } from "@cubejs-client/core";
import { randomUUID } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { expandPresetDateRanges } from "@/modules/ee/analysis/lib/date-presets";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { type TCubeQuerySource, getCubeApiConfig } from "./cube-config";
import { getCubeQueryAuditSummary, validateCubeQueryMembers } from "./cube-query";

const CUBE_QUERY_ERROR_MESSAGE =
  "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running.";

type TScopedCubeQueryInput = {
  query: TChartQuery;
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  source: TCubeQuerySource;
};

const queueCubeQueryAuditEvent = ({
  error,
  input,
  requestId,
  status,
}: {
  error?: unknown;
  input: TScopedCubeQueryInput;
  requestId: string;
  status: "success" | "failure";
}) => {
  const errorName = error instanceof Error ? error.name : undefined;

  void queueAuditEventWithoutRequest({
    action: "queried",
    targetType: "cubeQuery",
    userId: input.userId,
    userType: "user",
    targetId: requestId,
    organizationId: input.organizationId,
    status,
    eventId: requestId,
    newObject: {
      requestId,
      tenantId: input.feedbackDirectoryId,
      feedbackDirectoryId: input.feedbackDirectoryId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      userId: input.userId,
      source: input.source,
      query: getCubeQueryAuditSummary(input.query),
      ...(errorName ? { errorName } : {}),
    },
    ipAddress: UNKNOWN_DATA,
  }).catch((auditError) => {
    logger.error(auditError, "Failed to queue Cube query audit event");
  });
};

/**
 * Cube's client pivot replaces a NULL measure with a fill value, defaulting to 0 — so a survey that
 * never asked a question renders identically to one that genuinely scored zero (npsScore and
 * csatScore in the Cube schema return NULL deliberately when there is nothing to compute).
 *
 * `fillWithValue: null` does not help: the client resolves the cell as
 * `row[measure] ?? fillWithValue ?? 0`, and a null fill falls straight through that chain back to 0.
 * So fill with a sentinel no real value can collide with, then turn it back into null here.
 */
const NULL_FILL_SENTINEL = "__formbricks_null__";

const restoreNullMeasures = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  rows.map((row) => {
    let hasSentinel = false;
    for (const value of Object.values(row)) {
      if (value === NULL_FILL_SENTINEL) {
        hasSentinel = true;
        break;
      }
    }
    if (!hasSentinel) return row;

    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === NULL_FILL_SENTINEL ? null : value])
    );
  });

export async function executeTenantScopedQuery(input: TScopedCubeQueryInput) {
  try {
    validateCubeQueryMembers(input.query);
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId: randomUUID(), status: "failure" });
    logger.warn(error, "Cube query validation failed");
    throw error;
  }

  const tenantScope = {
    feedbackDirectoryId: input.feedbackDirectoryId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    userId: input.userId,
    source: input.source,
  };
  let apiUrl: string;
  let requestId: string;
  let token: string;

  try {
    ({ apiUrl, requestId, token } = getCubeApiConfig(tenantScope));
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId: randomUUID(), status: "failure" });
    logger.error(error, "Cube query configuration failed");
    throw error;
  }

  try {
    const client = cubejs(token, { apiUrl });
    const resultSet = await client.load(expandPresetDateRanges(input.query) as Query);
    const result = restoreNullMeasures(resultSet.tablePivot({ fillWithValue: NULL_FILL_SENTINEL }));
    queueCubeQueryAuditEvent({ input, requestId, status: "success" });
    return result;
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId, status: "failure" });
    logger.error(error, "Cube query failed");

    throw new Error(CUBE_QUERY_ERROR_MESSAGE);
  }
}
