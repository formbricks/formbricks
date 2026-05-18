/* eslint-env es2022 */

const TENANT_MEMBERS = ["FeedbackRecords.tenantId"];
const REQUIRED_SCOPE = "xm:cube:query";

function assertRequiredEnvironmentVariable(name) {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required to run Cube`);
  }
}

assertRequiredEnvironmentVariable("CUBEJS_API_SECRET");

function getStringClaim(securityContext, claim) {
  const value = securityContext?.[claim];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getRequiredStringClaim(securityContext, claim) {
  const value = getStringClaim(securityContext, claim);

  if (!value) {
    throw new Error(`Cube query rejected: missing ${claim} security context`);
  }

  return value;
}

function collectFilterMembers(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.flatMap((filter) => [
    ...(typeof filter?.member === "string" ? [filter.member] : []),
    ...(typeof filter?.dimension === "string" ? [filter.dimension] : []),
    ...collectFilterMembers(filter?.and),
    ...collectFilterMembers(filter?.or),
  ]);
}

function collectOrderMembers(order) {
  if (!order) {
    return [];
  }

  if (Array.isArray(order)) {
    return order
      .map((orderEntry) => (Array.isArray(orderEntry) ? orderEntry[0] : null))
      .filter((member) => typeof member === "string");
  }

  if (typeof order === "object") {
    return Object.keys(order);
  }

  return [];
}

function collectTimeDimensionMembers(timeDimensions) {
  if (!Array.isArray(timeDimensions)) {
    return [];
  }

  return timeDimensions
    .map((timeDimension) => timeDimension?.dimension)
    .filter((dimension) => typeof dimension === "string");
}

function collectQueryMembers(query) {
  const cubeQuery = query ?? {};
  const members = [
    ...(Array.isArray(cubeQuery.measures) ? cubeQuery.measures : []),
    ...(Array.isArray(cubeQuery.dimensions) ? cubeQuery.dimensions : []),
    ...(Array.isArray(cubeQuery.segments) ? cubeQuery.segments : []),
    ...collectTimeDimensionMembers(cubeQuery.timeDimensions),
    ...collectFilterMembers(cubeQuery.filters),
    ...collectOrderMembers(cubeQuery.order),
  ].filter((member) => typeof member === "string");

  return Array.from(new Set(members)).sort((a, b) => a.localeCompare(b));
}

function assertValidSecurityContext(securityContext) {
  const tenantId = getRequiredStringClaim(securityContext, "tenantId");
  const feedbackDirectoryId = getRequiredStringClaim(securityContext, "feedbackDirectoryId");
  const workspaceId = getRequiredStringClaim(securityContext, "workspaceId");
  const scope = getRequiredStringClaim(securityContext, "scope");

  if (scope !== REQUIRED_SCOPE) {
    throw new Error("Cube query rejected: invalid Cube query scope");
  }
  if (tenantId !== feedbackDirectoryId) {
    throw new Error("Cube query rejected: tenantId/feedbackDirectoryId mismatch");
  }

  return {
    tenantId,
    feedbackDirectoryId,
    workspaceId,
    organizationId: getRequiredStringClaim(securityContext, "organizationId"),
    userId: getRequiredStringClaim(securityContext, "userId"),
    requestId: getRequiredStringClaim(securityContext, "jti"),
    source: getRequiredStringClaim(securityContext, "source"),
  };
}

function assertNoCallerTenantMember(query) {
  for (const member of collectQueryMembers(query)) {
    if (TENANT_MEMBERS.includes(member)) {
      throw new Error("Cube query rejected: tenant filters are enforced by Cube");
    }
  }
}

function logCubeQueryAuditEvent(context, query, { error, status = "success" } = {}) {
  const errorName = error instanceof Error ? error.name : undefined;
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined;

  console.log(
    JSON.stringify({
      type: "audit",
      event: "cube.query",
      status,
      timestamp: new Date().toISOString(),
      tenantId: context.tenantId,
      feedbackDirectoryId: context.feedbackDirectoryId,
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      userId: context.userId,
      requestId: context.requestId,
      source: context.source,
      members: collectQueryMembers(query),
      ...(errorName ? { errorName } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    })
  );
}

function logCubeQuerySecurityContextFailure(query, error) {
  console.log(
    JSON.stringify({
      type: "audit",
      event: "cube.query",
      status: "failure",
      timestamp: new Date().toISOString(),
      members: collectQueryMembers(query),
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  );
}

function queryRewrite(query, rewriteContext) {
  const cubeQuery = query ?? {};
  let context;

  try {
    context = assertValidSecurityContext(rewriteContext?.securityContext);
  } catch (error) {
    logCubeQuerySecurityContextFailure(cubeQuery, error);
    throw error;
  }

  try {
    assertNoCallerTenantMember(cubeQuery);
  } catch (error) {
    logCubeQueryAuditEvent(context, cubeQuery, { error, status: "failure" });
    throw error;
  }

  const queriedCubePrefixes = new Set(collectQueryMembers(cubeQuery).map((member) => member.split(".")[0]));
  const rewrittenQuery = {
    ...cubeQuery,
    filters: [
      ...(Array.isArray(cubeQuery.filters) ? cubeQuery.filters : []),
      ...TENANT_MEMBERS.filter((member) => queriedCubePrefixes.has(member.split(".")[0])).map(
        (member) => ({
          member,
          operator: "equals",
          values: [context.tenantId],
        })
      ),
    ],
  };

  logCubeQueryAuditEvent(context, rewrittenQuery);
  return rewrittenQuery;
}

module.exports = {
  queryRewrite,
};
