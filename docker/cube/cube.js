/* eslint-env es2022 */

const { createHash } = require("node:crypto");

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

function hasClaim(securityContext, claim) {
  return securityContext?.[claim] !== undefined && securityContext?.[claim] !== null;
}

// Who the query runs for: a user (session or OAuth) or an API key, which has no user behind it. The token
// carries exactly one of the two claims, so the audit line can never attribute a key's query to a person;
// a token naming both, or neither, is refused rather than guessed at.
function getActor(securityContext) {
  const hasUser = hasClaim(securityContext, "userId");
  const hasApiKey = hasClaim(securityContext, "apiKeyId");

  if (hasUser && hasApiKey) {
    throw new Error("Cube query rejected: userId and apiKeyId security context are mutually exclusive");
  }
  if (hasApiKey) {
    return { type: "apiKey", id: getRequiredStringClaim(securityContext, "apiKeyId") };
  }
  if (hasUser) {
    return { type: "user", id: getRequiredStringClaim(securityContext, "userId") };
  }

  throw new Error("Cube query rejected: missing userId or apiKeyId security context");
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
    actor: getActor(securityContext),
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
      actor: context.actor,
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
  "FeedbackRecords.metadataSource": "FeedbackRecords.metadataSourceNormalized",
  "FeedbackRecords.metadataBrowser": "FeedbackRecords.metadataBrowserNormalized",
  "FeedbackRecords.metadataOs": "FeedbackRecords.metadataOsNormalized",
  "FeedbackRecords.metadataDevice": "FeedbackRecords.metadataDeviceNormalized",
  "FeedbackRecords.metadataCountry": "FeedbackRecords.metadataCountryNormalized",
  "FeedbackRecords.metadataAction": "FeedbackRecords.metadataActionNormalized",
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

// Embedded Data dimensions (ENG-2848). The app signs the directory's Embedded Data fields into the
// token as `embeddedFields: [{ id, hex, type }]` and schema/FeedbackRecords.js turns each into a
// dimension through COMPILE_CONTEXT. Cube compiles one schema per app id, so the id is a hash of the
// list: every directory with the same fields shares one compiled schema, and a token without fields
// keeps the default app id and compiles to exactly the fixed members.
const EMBEDDED_FIELD_ID = /^ed_[0-9a-f]{16}$/;
const EMBEDDED_FIELD_HEX = /^(?:[0-9a-f]{2}){1,512}$/;
const EMBEDDED_FIELD_TYPES = new Set(["string", "number", "boolean"]);
const MAX_EMBEDDED_FIELDS = 200;
const DEFAULT_APP_ID = "CUBEJS_APP";

function getEmbeddedFields(securityContext) {
  const fields = securityContext?.embeddedFields;
  if (fields === undefined || fields === null) {
    return [];
  }
  if (!Array.isArray(fields) || fields.length > MAX_EMBEDDED_FIELDS) {
    throw new Error("Cube query rejected: invalid embeddedFields security context");
  }

  const ids = new Set();
  for (const field of fields) {
    if (
      typeof field?.id !== "string" ||
      typeof field?.hex !== "string" ||
      !EMBEDDED_FIELD_ID.test(field.id) ||
      !EMBEDDED_FIELD_HEX.test(field.hex) ||
      !EMBEDDED_FIELD_TYPES.has(field.type) ||
      ids.has(field.id)
    ) {
      throw new Error("Cube query rejected: invalid embeddedFields security context");
    }
    ids.add(field.id);
  }

  return fields;
}

function contextToAppId(context) {
  const fields = getEmbeddedFields(context?.securityContext);
  if (fields.length === 0) {
    return DEFAULT_APP_ID;
  }

  const canonical = fields
    .map((field) => `${field.id}:${field.hex}:${field.type}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
  return `CUBEJS_APP_ed_${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

// Every app id shares one query orchestrator — one connection pool and one cache — instead of Cube's
// default of one per app id. Tenancy does not depend on the orchestrator: queryRewrite adds the tenant
// filter, so it is part of every generated SQL statement and therefore of every cache key.
function contextToOrchestratorId() {
  return DEFAULT_APP_ID;
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
  contextToAppId,
  contextToOrchestratorId,
  // One compiled schema per distinct Embedded Data field list, measured at ~5 MB and ~0.4 s each: keep
  // the 100 most recent, and let one nobody queried for half an hour go.
  compilerCacheSize: 100,
  maxCompilerCacheKeepAlive: 30 * 60 * 1000,
  queryRewrite,
};
