/* eslint-env es2022 */

const crypto = require("crypto");

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

// ── Embedded data ────────────────────────────────────────────────────────────────────────────────
// Each Feedback Dataset compiles its own FeedbackRecords model: the app passes the dataset's most
// frequent embedded-data keys in the signed token (`edKeys`), `contextToAppId` gives every distinct
// (dataset, key set) its own compiled model, and schema/FeedbackRecords.js turns each key into one
// `FeedbackRecords.ed_<slug>_<hash>` dimension through `getEmbeddedDimensionSpecs`. Cube never looks
// keys up itself, and one dataset's key names never reach another dataset's `/meta`.

/**
 * Most keys one token compiles: the app sends a dataset's 100 most frequent keys plus at most one bucket
 * of 10 rarer keys a saved query names (apps/web `MAX_TOKEN_EMBEDDED_KEYS`).
 */
const MAX_EMBEDDED_KEYS = 110;
/**
 * Most UTF-8 bytes the keys of one token may take as JSON writes them (apps/web
 * `MAX_TOKEN_EMBEDDED_KEYS_BYTES`). The app stays within it; this guard keeps a token that does not from
 * compiling a model bigger than the app ever asks for.
 */
const MAX_EMBEDDED_KEYS_BYTES = 8192;
/** Longest key compiled. A longer one is dropped rather than truncated, so names stay exact. */
const MAX_EMBEDDED_KEY_LENGTH = 128;
const EMBEDDED_MEMBER_PREFIX = "ed_";
/**
 * Hidden twin of an embedded dimension that only `equals` filters are moved onto. Its FILTER_PARAMS
 * containment predicate (`@>`) is what a GIN index on `metadata->'embedded_data'` can serve; it lives on
 * a twin because FILTER_PARAMS hands the predicate the filter's values whatever its operator, and a
 * `notEquals` or `contains` must never be narrowed by a containment.
 */
const EMBEDDED_EQUALS_MEMBER_PREFIX = "edc_";
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// C0 and C1 control characters (NUL included): never a key anyone means, and a title or log line breaker.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * The keys a token names, in the one order every caller sees: strings only, no blank key (a blank
 * dimension title breaks the whole model, and failed compiles are not cached), none longer than
 * `MAX_EMBEDDED_KEY_LENGTH`, no control character, none Postgres text cannot hold, no duplicates, at most
 * `MAX_EMBEDDED_KEYS` keys and `MAX_EMBEDDED_KEYS_BYTES` bytes.
 */
function getEmbeddedKeys(securityContext) {
  const claim = securityContext?.edKeys;
  if (!Array.isArray(claim)) {
    return [];
  }

  const keys = new Set();
  let bytes = 0;
  for (const key of claim) {
    if (keys.size >= MAX_EMBEDDED_KEYS) break;
    if (typeof key !== "string" || key.trim().length === 0 || key.length > MAX_EMBEDDED_KEY_LENGTH) continue;
    if (CONTROL_CHARACTER.test(key) || LONE_SURROGATE.test(key) || keys.has(key)) continue;
    const keyBytes = Buffer.byteLength(JSON.stringify(key), "utf8");
    if (bytes + keyBytes > MAX_EMBEDDED_KEYS_BYTES) continue;
    bytes += keyBytes;
    keys.add(key);
  }

  return Array.from(keys).sort();
}

const sha256Hex = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

/**
 * `ed_<ascii slug, at most 24 characters>_<first 8 hex of sha256(key)>`. The slug keeps the name
 * readable; the hash keeps it unique and stable, so `Plan`, `plan` and `plan ` are three members and
 * a key keeps its member name in every dataset and over time. apps/web mirrors this function
 * (`getEmbeddedMemberName`) and a test keeps the two equal.
 */
function getEmbeddedMemberSuffix(key) {
  const slug = key
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/, "");
  const hash = sha256Hex(key).slice(0, 8);
  return slug ? `${slug}_${hash}` : hash;
}

/**
 * A Postgres string literal for `value` that holds nothing but letters, digits, spaces, `_` and `-`:
 * every other character is a `\uXXXX` / `\UXXXXXXXX` escape. A key is respondent-controlled text, and
 * besides quotes Cube itself rewrites `$<n>$` and `?` sequences in generated SQL, so none of those may
 * reach it verbatim.
 */
function toSafeSqlStringLiteral(value) {
  let literal = "";
  for (const character of value) {
    if (/^[A-Za-z0-9 _-]$/.test(character)) {
      literal += character;
      continue;
    }
    const codePoint = character.codePointAt(0);
    literal +=
      codePoint > 0xffff
        ? `\\U${codePoint.toString(16).padStart(8, "0")}`
        : `\\u${codePoint.toString(16).padStart(4, "0")}`;
  }
  return `E'${literal}'`;
}

/**
 * What schema/FeedbackRecords.js compiles for the token's keys: one dimension per key and the SQL its
 * containment predicate needs. Two keys whose names would collide (an 8-hex collision among 100 keys)
 * keep the first, because a duplicate member fails the whole model.
 */
function getEmbeddedDimensionSpecs(compileContext) {
  const names = new Set();
  const specs = [];
  for (const key of getEmbeddedKeys(compileContext?.securityContext)) {
    const suffix = getEmbeddedMemberSuffix(key);
    if (names.has(suffix)) continue;
    names.add(suffix);
    const keyLiteral = toSafeSqlStringLiteral(key);
    specs.push({
      key,
      name: `${EMBEDDED_MEMBER_PREFIX}${suffix}`,
      equalsName: `${EMBEDDED_EQUALS_MEMBER_PREFIX}${suffix}`,
      valueSql: `metadata->'embedded_data'->>${keyLiteral}`,
      keyLiteral,
    });
  }
  return specs;
}

/**
 * The containment predicate for one `equals` filter on an embedded key, as a superset of
 * `metadata->'embedded_data'->>key IN (values)`: a value stored as a JSON number or boolean reads as the
 * same text, so a numeric- or boolean-looking value is also tried in that type. Exact-case, like the
 * dimension itself.
 */
function getEmbeddedContainmentSql(keyLiteral, values) {
  const object = (value) => `metadata->'embedded_data' @> jsonb_build_object(${keyLiteral}, ${value})`;
  const alternatives = values.map((value) =>
    [
      object(`${value}::text`),
      object(
        `CASE WHEN ${value}::text ~ '^\\s*[-+]?([0-9]+[.]?[0-9]*|[.][0-9]+)([eE][-+]?[0-9]{1,3})?\\s*$' THEN (${value}::text)::numeric END`
      ),
      object(`CASE WHEN ${value}::text IN ('true', 'false') THEN (${value}::text)::boolean END`),
    ].join(" OR ")
  );
  return alternatives.length > 0 ? `(${alternatives.join(" OR ")})` : "1 = 1";
}

const EMBEDDED_MEMBER_PATTERN = /^FeedbackRecords\.ed_[a-z0-9_]+$/;

/**
 * `equals` on an embedded dimension moves to its hidden twin; everything else is left as written. Cube
 * accepts a filter's member as `member` or as the older `dimension`, so both are moved.
 */
function moveEmbeddedEqualsFilter(filter) {
  if (!filter || typeof filter !== "object") {
    return filter;
  }
  if (Array.isArray(filter.and)) {
    return { ...filter, and: filter.and.map(moveEmbeddedEqualsFilter) };
  }
  if (Array.isArray(filter.or)) {
    return { ...filter, or: filter.or.map(moveEmbeddedEqualsFilter) };
  }
  const memberKey = typeof filter.member === "string" ? "member" : "dimension";
  const member = filter[memberKey];
  if (filter.operator === "equals" && typeof member === "string" && EMBEDDED_MEMBER_PATTERN.test(member)) {
    return {
      ...filter,
      [memberKey]: member.replace(
        `FeedbackRecords.${EMBEDDED_MEMBER_PREFIX}`,
        `FeedbackRecords.${EMBEDDED_EQUALS_MEMBER_PREFIX}`
      ),
    };
  }
  return filter;
}

/**
 * One compiled model per dataset and key set. A dataset without keys compiles the plain model, which is
 * the same for every dataset, so they all share it.
 */
function contextToAppId({ securityContext } = {}) {
  const keys = getEmbeddedKeys(securityContext);
  const tenantId = getStringClaim(securityContext, "tenantId");
  if (keys.length === 0 || !tenantId) {
    return "FB_BASE";
  }
  return `FB_ED_${sha256Hex(JSON.stringify([tenantId, keys])).slice(0, 32)}`;
}

// ── Answer filters ──────────────────────────────────────────────────────────────────────────────
// A chart filters by how the same submission answered another question with ONE public condition on
// the virtual member `FeedbackRecords.answer`, values "<questionId>:<valueKey>". queryRewrite gives each
// rule its own `AnswerFilterN` join (schema/FeedbackRecords.js, on tenant + submission) and expands it
// onto the typed plain column the question's kind stores its answer in; COALESCE'd columns were 3-25x
// slower. The kind comes from the token (`answerKinds`, from the app's field catalog). A submission that
// did not answer the question has no joined row, so it matches no rule — "is not" included.

const ANSWER_MEMBER = "FeedbackRecords.answer";
const ANSWER_FILTER_ALIAS_COUNT = 25;
const ANSWER_FILTER_CUBE = /^AnswerFilter\d+$/;
const NUMERIC_VALUE = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

function getAnswerKind(securityContext, questionId) {
  const kinds = securityContext?.answerKinds;
  const kind =
    kinds && typeof kinds === "object" && Object.hasOwn(kinds, questionId) ? kinds[questionId] : undefined;
  if (!["choice", "multi", "number"].includes(kind)) {
    throw new Error("Cube query rejected: an answer rule names a question with no known kind");
  }
  return kind;
}

function parseAnswerRule(filter) {
  if (filter.operator !== "equals" && filter.operator !== "notEquals") {
    throw new Error("Cube query rejected: an answer rule takes equals or notEquals");
  }
  if (!Array.isArray(filter.values) || filter.values.length === 0) {
    throw new Error("Cube query rejected: an answer rule needs at least one value");
  }

  const questions = new Set();
  const valueKeys = filter.values.map((value) => {
    const separator = typeof value === "string" ? value.indexOf(":") : -1;
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error("Cube query rejected: an answer rule value is <questionId>:<valueKey>");
    }
    questions.add(value.slice(0, separator));
    return value.slice(separator + 1);
  });
  if (questions.size !== 1) {
    throw new Error("Cube query rejected: an answer rule names exactly one question");
  }

  return { questionId: Array.from(questions)[0], operator: filter.operator, valueKeys };
}

function expandAnswerRule(rule, kind, alias) {
  const condition = (member, operator, values) => ({ member: `${alias}.${member}`, operator, values });

  switch (kind) {
    case "multi":
      // One record per selected option: field_id `<question>__<option>`, field_group_id the question.
      // "Does not contain" is not offered: a join cannot express it.
      if (rule.operator !== "equals") {
        throw new Error("Cube query rejected: a multi-select answer rule takes equals only");
      }
      return {
        and: [
          condition("fieldGroupId", "equals", [rule.questionId]),
          condition(
            "fieldId",
            "equals",
            rule.valueKeys.map((valueKey) => `${rule.questionId}__${valueKey}`)
          ),
        ],
      };
    case "number":
      if (!rule.valueKeys.every((valueKey) => NUMERIC_VALUE.test(valueKey))) {
        throw new Error("Cube query rejected: a number answer rule takes numbers");
      }
      return {
        and: [
          condition("fieldId", "equals", [rule.questionId]),
          condition("valueNumber", rule.operator, rule.valueKeys),
        ],
      };
    default:
      return {
        and: [
          condition("fieldId", "equals", [rule.questionId]),
          condition("valueId", rule.operator, rule.valueKeys),
        ],
      };
  }
}

/** Expands every answer rule in `filters`, numbering the aliases in the order the rules appear. */
function expandAnswerRules(filters, securityContext) {
  if (!Array.isArray(filters)) {
    return filters;
  }

  let aliasCount = 0;
  const expand = (filter) => {
    if (!filter || typeof filter !== "object") {
      return filter;
    }
    if (Array.isArray(filter.and)) {
      return { ...filter, and: filter.and.map(expand) };
    }
    if (Array.isArray(filter.or)) {
      return { ...filter, or: filter.or.map(expand) };
    }
    if (filter.member !== ANSWER_MEMBER && filter.dimension !== ANSWER_MEMBER) {
      return filter;
    }

    aliasCount += 1;
    if (aliasCount > ANSWER_FILTER_ALIAS_COUNT) {
      throw new Error(`Cube query rejected: at most ${ANSWER_FILTER_ALIAS_COUNT} answer rules`);
    }
    const rule = parseAnswerRule(filter);
    return expandAnswerRule(
      rule,
      getAnswerKind(securityContext, rule.questionId),
      `AnswerFilter${aliasCount}`
    );
  };

  return filters.map(expand);
}

/**
 * Members only the rewrite may write: the answer-filter joins, the embedded `equals` twins, and the
 * answer member anywhere but a filter (it has no column to select or sort by).
 */
function assertNoReservedMember(query) {
  const cubeQuery = query ?? {};
  for (const member of collectQueryMembers(cubeQuery)) {
    const [cubeName, memberName = ""] = member.split(".");
    if (ANSWER_FILTER_CUBE.test(cubeName) || memberName.startsWith(EMBEDDED_EQUALS_MEMBER_PREFIX)) {
      throw new Error("Cube query rejected: reserved member");
    }
  }
  const selected = [
    ...(Array.isArray(cubeQuery.measures) ? cubeQuery.measures : []),
    ...(Array.isArray(cubeQuery.dimensions) ? cubeQuery.dimensions : []),
    ...(Array.isArray(cubeQuery.segments) ? cubeQuery.segments : []),
    ...collectTimeDimensionMembers(cubeQuery.timeDimensions),
    ...collectOrderMembers(cubeQuery.order),
  ];
  if (selected.includes(ANSWER_MEMBER)) {
    throw new Error("Cube query rejected: FeedbackRecords.answer is a filter only");
  }
}

/**
 * Compiled-model cache limits for one Cube process. Every dataset with embedded keys is its own model,
 * measured at about 2-5 MB each once compiled (more keys, more members), so the defaults (250 models, no
 * member budget) can outgrow the Helm chart's 1 GiB limit. 60 models at 500 members each keep the cache
 * within about 300 MB; a dataset whose model was evicted compiles again on its next query. The operator's
 * CUBEJS_COMPILER_CACHE_SIZE / CUBEJS_MAX_COMPILED_MEMBERS win when set.
 */
const DEFAULT_COMPILER_CACHE_SIZE = 60;
const DEFAULT_MAX_COMPILED_MEMBERS = DEFAULT_COMPILER_CACHE_SIZE * 500;

function getCompilerCacheOptions() {
  return {
    ...(process.env.CUBEJS_COMPILER_CACHE_SIZE ? {} : { compilerCacheSize: DEFAULT_COMPILER_CACHE_SIZE }),
    ...(process.env.CUBEJS_MAX_COMPILED_MEMBERS ? {} : { maxCompiledMembers: DEFAULT_MAX_COMPILED_MEMBERS }),
  };
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

  let expandedFilters;
  try {
    assertNoCallerTenantMember(cubeQuery);
    assertNoReservedMember(cubeQuery);
    expandedFilters = expandAnswerRules(cubeQuery.filters, rewriteContext.securityContext);
  } catch (error) {
    logCubeQueryAuditEvent(context, cubeQuery, { error, status: "failure" });
    throw error;
  }

  const queriedCubePrefixes = new Set(collectQueryMembers(cubeQuery).map((member) => member.split(".")[0]));
  const normalizedFilters = normalizeCaseInsensitiveFilters(expandedFilters);
  const embeddedFilters = Array.isArray(normalizedFilters)
    ? normalizedFilters.map(moveEmbeddedEqualsFilter)
    : normalizedFilters;
  const rewrittenQuery = {
    ...cubeQuery,
    filters: [
      ...(Array.isArray(embeddedFilters) ? embeddedFilters : []),
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
  contextToAppId,
  ...getCompilerCacheOptions(),
};

// Cube validates its options strictly, so what schema/FeedbackRecords.js needs from this file rides along
// as non-enumerable properties Cube does not see.
for (const [name, value] of Object.entries({
  getEmbeddedDimensionSpecs,
  getEmbeddedContainmentSql,
  getEmbeddedMemberSuffix,
  getEmbeddedKeys,
  toSafeSqlStringLiteral,
  ANSWER_FILTER_ALIAS_COUNT,
  MAX_EMBEDDED_KEYS,
  MAX_EMBEDDED_KEYS_BYTES,
  MAX_EMBEDDED_KEY_LENGTH,
})) {
  Object.defineProperty(module.exports, name, { value, enumerable: false });
}
