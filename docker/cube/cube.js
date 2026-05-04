/* eslint-env es2022 */

const TENANT_MEMBER = "FeedbackRecords.tenantId";
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
  const tenantIdClaim = getRequiredStringClaim(securityContext, "tenantId");
  const workspaceId = getRequiredStringClaim(securityContext, "workspaceId");
  const scope = getRequiredStringClaim(securityContext, "scope");

  if (scope !== REQUIRED_SCOPE) {
    throw new Error("Cube query rejected: invalid Cube query scope");
  }
  if (tenantIdClaim !== workspaceId) {
    throw new Error("Cube query rejected: tenantId/workspaceId mismatch");
  }

  return {
    tenantId: workspaceId,
    workspaceId,
    organizationId: getRequiredStringClaim(securityContext, "organizationId"),
    userId: getRequiredStringClaim(securityContext, "userId"),
    requestId: getRequiredStringClaim(securityContext, "jti"),
    source: getRequiredStringClaim(securityContext, "source"),
  };
}

function assertNoCallerTenantMember(query) {
  for (const member of collectQueryMembers(query)) {
    if (member === TENANT_MEMBER) {
      throw new Error("Cube query rejected: tenant filters are enforced by Cube");
    }
  }
}

function logCubeQueryAuditEvent(context, query, { error, status = "success" } = {}) {
  const errorName = error instanceof Error ? error.name : undefined;

  console.log(
    JSON.stringify({
      type: "audit",
      event: "cube.query",
      status,
      timestamp: new Date().toISOString(),
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      userId: context.userId,
      requestId: context.requestId,
      source: context.source,
      members: collectQueryMembers(query),
      ...(errorName ? { errorName } : {}),
    })
  );
}

function queryRewrite(query, rewriteContext) {
  const cubeQuery = query ?? {};
  const context = assertValidSecurityContext(rewriteContext?.securityContext);

  try {
    assertNoCallerTenantMember(cubeQuery);
  } catch (error) {
    logCubeQueryAuditEvent(context, cubeQuery, { error, status: "failure" });
    throw error;
  }

  const rewrittenQuery = {
    ...cubeQuery,
    filters: [
      ...(Array.isArray(cubeQuery.filters) ? cubeQuery.filters : []),
      {
        member: TENANT_MEMBER,
        operator: "equals",
        values: [context.workspaceId],
      },
    ],
  };

  logCubeQueryAuditEvent(context, rewrittenQuery);
  return rewrittenQuery;
}

module.exports = {
  queryRewrite,
};
