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

// String dimensions whose `equals` / `notEquals` filters should be case- and
// whitespace-insensitive. Each maps to a hidden companion dimension defined in
// schema/FeedbackRecords.js as LOWER(TRIM(<column>)). The visible dimension is left
// untouched (so grouping/display keep the original-cased value); only exact-match
// filters are rewritten onto the normalized companion. Keep this map in sync with
// the *Normalized dimensions in schema/FeedbackRecords.js.
const CASE_INSENSITIVE_EQUALS_DIMENSIONS = {
  "FeedbackRecords.sourceType": "FeedbackRecords.sourceTypeNormalized",
  "FeedbackRecords.sourceName": "FeedbackRecords.sourceNameNormalized",
  "FeedbackRecords.fieldType": "FeedbackRecords.fieldTypeNormalized",
  "FeedbackRecords.fieldLabel": "FeedbackRecords.fieldLabelNormalized",
  "FeedbackRecords.fieldGroupLabel": "FeedbackRecords.fieldGroupLabelNormalized",
  "FeedbackRecords.language": "FeedbackRecords.languageNormalized",
  "FeedbackRecords.valueText": "FeedbackRecords.valueTextNormalized",
};

const CASE_INSENSITIVE_OPERATORS = new Set(["equals", "notEquals"]);

function normalizeFilterValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

// Rewrites a single filter node: exact-match filters on a normalizable string
// dimension are redirected to the *Normalized companion with lowercased/trimmed
// values; nested and/or groups recurse; everything else is returned unchanged.
function normalizeCaseInsensitiveFilter(filter) {
  if (!filter || typeof filter !== "object") {
    return filter;
  }

  if (Array.isArray(filter.and)) {
    return { ...filter, and: filter.and.map(normalizeCaseInsensitiveFilter) };
  }

  if (Array.isArray(filter.or)) {
    return { ...filter, or: filter.or.map(normalizeCaseInsensitiveFilter) };
  }

  const normalizedMember = CASE_INSENSITIVE_EQUALS_DIMENSIONS[filter.member];
  if (
    typeof filter.member === "string" &&
    normalizedMember &&
    typeof filter.operator === "string" &&
    CASE_INSENSITIVE_OPERATORS.has(filter.operator)
  ) {
    return {
      ...filter,
      member: normalizedMember,
      ...(Array.isArray(filter.values) ? { values: filter.values.map(normalizeFilterValue) } : {}),
    };
  }

  return filter;
}

function normalizeCaseInsensitiveFilters(filters) {
  if (!Array.isArray(filters)) {
    return filters;
  }

  return filters.map(normalizeCaseInsensitiveFilter);
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
  const normalizedFilters = normalizeCaseInsensitiveFilters(cubeQuery.filters);
  const rewrittenQuery = {
    ...cubeQuery,
    filters: [
      ...(Array.isArray(normalizedFilters) ? normalizedFilters : []),
      ...TENANT_MEMBERS.filter((member) => queriedCubePrefixes.has(member.split(".")[0])).map((member) => ({
        member,
        operator: "equals",
        values: [context.tenantId],
      })),
    ],
  };

  logCubeQueryAuditEvent(context, rewrittenQuery);
  return rewrittenQuery;
}

module.exports = {
  queryRewrite,
};
