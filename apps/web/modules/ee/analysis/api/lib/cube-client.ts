import "server-only";
import cubejs, { type Query } from "@cubejs-client/core";
import { randomUUID } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
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
    const resultSet = await client.load(input.query as Query);
    const result = resultSet.tablePivot();
    queueCubeQueryAuditEvent({ input, requestId, status: "success" });
    return result;
  } catch (error) {
    queueCubeQueryAuditEvent({ error, input, requestId, status: "failure" });
    logger.error(error, "Cube query failed");

    throw new Error(CUBE_QUERY_ERROR_MESSAGE);
  }
}
