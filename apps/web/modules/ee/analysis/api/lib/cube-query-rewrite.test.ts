import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const cubeConfigPath = require.resolve("../../../../../../../docker/cube/cube.js");
const chartCubeConfigPath = require.resolve("../../../../../../../charts/formbricks/cube/cube.js");
const cubeSchemaPath = require.resolve("../../../../../../../docker/cube/schema/FeedbackRecords.js");
process.env.CUBEJS_API_SECRET = process.env.CUBEJS_API_SECRET || "cube-secret";

type TEmbeddedDimensionSpec = {
  key: string;
  name: string;
  equalsName: string;
  valueSql: string;
  keyLiteral: string;
};

const cubeConfig = require(cubeConfigPath) as {
  queryRewrite: (
    query: Record<string, unknown>,
    context: { securityContext?: Record<string, unknown> }
  ) => Record<string, unknown>;
  contextToAppId: (context: { securityContext?: Record<string, unknown> }) => string;
  compilerCacheSize?: number;
  maxCompiledMembers?: number;
  getEmbeddedDimensionSpecs: (compileContext: {
    securityContext?: Record<string, unknown>;
  }) => TEmbeddedDimensionSpec[];
  getEmbeddedContainmentSql: (keyLiteral: string, values: string[]) => string;
  getEmbeddedKeys: (securityContext?: Record<string, unknown>) => string[];
  toSafeSqlStringLiteral: (value: string) => string;
  ANSWER_FILTER_ALIAS_COUNT: number;
};
const { queryRewrite } = cubeConfig;

const securityContext = {
  tenantId: "frd-1",
  feedbackDirectoryId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  userId: "user-1",
  scope: "xm:cube:query",
  source: "v3.charts.data",
  jti: "request-1",
};

describe("cube queryRewrite", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("rejects queries without tenant security context", () => {
    expect(() => queryRewrite({ measures: ["FeedbackRecords.count"] }, {})).toThrow(
      /missing tenantId security context/
    );

    const logPayload = vi.mocked(console.log).mock.calls[0][0];
    const parsed = JSON.parse(logPayload);
    expect(parsed).toMatchObject({
      type: "audit",
      event: "cube.query",
      status: "failure",
      errorName: "Error",
      errorMessage: "Cube query rejected: missing tenantId security context",
    });
  });

  test("rejects Cube startup without an API secret", () => {
    const originalSecret = process.env.CUBEJS_API_SECRET;
    delete process.env.CUBEJS_API_SECRET;
    delete require.cache[cubeConfigPath];

    expect(() => require(cubeConfigPath)).toThrow(/CUBEJS_API_SECRET is required to run Cube/);

    process.env.CUBEJS_API_SECRET = originalSecret || "cube-secret";
    delete require.cache[cubeConfigPath];
  });

  test("rejects queries without a rewrite context", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        undefined as unknown as { securityContext?: Record<string, unknown> }
      )
    ).toThrow(/missing tenantId security context/);
  });

  test("rejects queries missing audit identity claims", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, organizationId: undefined } }
      )
    ).toThrow(/missing organizationId security context/);
  });

  test("rejects queries without the Cube query scope", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, scope: "other:scope" } }
      )
    ).toThrow(/invalid Cube query scope/);
  });

  // ENG-6582: a query runs for a user or for an API key, never both and never nobody, and the audit line
  // names which — so a key's query is never attributed to a person.
  test("attributes a query carrying an apiKeyId to that API key", () => {
    const { userId: _userId, ...withoutUser } = securityContext;

    queryRewrite(
      { measures: ["FeedbackRecords.count"] },
      { securityContext: { ...withoutUser, apiKeyId: "key-1" } }
    );

    const parsed = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(parsed).toMatchObject({ status: "success", actor: { type: "apiKey", id: "key-1" } });
    expect(parsed).not.toHaveProperty("userId");
  });

  test("rejects a token naming both a user and an API key", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, apiKeyId: "key-1" } }
      )
    ).toThrow(/userId and apiKeyId security context are mutually exclusive/);
  });

  test("rejects a token naming neither a user nor an API key", () => {
    const { userId: _userId, ...withoutUser } = securityContext;

    expect(() =>
      queryRewrite({ measures: ["FeedbackRecords.count"] }, { securityContext: withoutUser })
    ).toThrow(/missing userId or apiKeyId security context/);
  });

  test("rejects a blank actor claim rather than falling back to the other one", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, userId: "  ", apiKeyId: "key-1" } }
      )
    ).toThrow(/mutually exclusive/);
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, userId: "  " } }
      )
    ).toThrow(/missing userId security context/);
  });

  test("rejects mismatched tenant and feedback directory claims", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, feedbackDirectoryId: "frd-2" } }
      )
    ).toThrow(/tenantId\/feedbackDirectoryId mismatch/);
  });

  test("rejects caller-supplied tenant filters", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);
  });

  test("logs sanitized failure audit metadata for rejected tenant filters", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["secret-value"] }],
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);

    const logPayload = vi.mocked(console.log).mock.calls[0][0];
    const parsed = JSON.parse(logPayload);
    expect(parsed).toMatchObject({
      type: "audit",
      event: "cube.query",
      status: "failure",
      tenantId: "frd-1",
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      actor: { type: "user", id: "user-1" },
      requestId: "request-1",
      source: "v3.charts.data",
      errorName: "Error",
    });
    expect(parsed.members).toContain("FeedbackRecords.tenantId");
    expect(logPayload).not.toContain("secret-value");
  });

  test("rejects deprecated dimension tenant filters", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          filters: [{ dimension: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);
  });

  test("rejects nested caller-supplied tenant filters", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          filters: [
            {
              or: [
                { member: "FeedbackRecords.sourceType", operator: "equals", values: ["positive"] },
                { member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] },
              ],
            },
          ],
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);
  });

  test("rejects caller-supplied tenant members outside filters", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.tenantId"],
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);
  });

  test("rejects caller-supplied tenant members in order clauses", () => {
    expect(() =>
      queryRewrite(
        {
          measures: ["FeedbackRecords.count"],
          order: { "FeedbackRecords.tenantId": "asc" },
        },
        { securityContext }
      )
    ).toThrow(/tenant filters are enforced by Cube/);
  });

  test("appends the mandatory tenant filter from security context", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["positive"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      // exact-match filters on string dimensions are redirected to the case-insensitive companion
      { member: "FeedbackRecords.sourceTypeNormalized", operator: "equals", values: ["positive"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
    expect(query.filters).toHaveLength(1);
  });

  test("rewrites equals on a string dimension to its case-insensitive companion", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.sourceName", operator: "equals", values: ["After-Match"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.sourceNameNormalized", operator: "equals", values: ["after-match"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("trims and lowercases values and handles notEquals", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.language", operator: "notEquals", values: ["  EN ", "De"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.languageNormalized", operator: "notEquals", values: ["en", "de"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("rewrites equals on a response-context dimension to its case-insensitive companion", () => {
    // A country arrives as "DE" from geo resolution but as "de" through a CSV import, and the
    // browser/device strings are whatever a user agent reported, so the metadata dimensions need
    // the same casing tolerance as the source ones.
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.metadataCountry", operator: "equals", values: [" DE "] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.metadataCountryNormalized", operator: "equals", values: ["de"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("leaves the product-generated response-context dimensions unrewritten", () => {
    // metadataSurveyType and metadataEndingId hold values this product writes, so they have no
    // normalized companion and must pass through as the caller sent them.
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.metadataSurveyType", operator: "equals", values: ["link"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.metadataSurveyType", operator: "equals", values: ["link"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("keeps the page URL case-sensitive", () => {
    // Scheme and host are case-insensitive, the path is not: /Foo and /foo are two different pages,
    // so folding case here would silently merge them for an exact filter.
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [
        {
          member: "FeedbackRecords.metadataUrl",
          operator: "equals",
          values: ["https://example.test/Foo"],
        },
      ],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.metadataUrl", operator: "equals", values: ["https://example.test/Foo"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("leaves contains and other substring operators untouched", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.sourceName", operator: "contains", values: ["After"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.sourceName", operator: "contains", values: ["After"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("does not rewrite equals on non-normalizable members (ids stay exact)", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.userId", operator: "equals", values: ["ABC-123"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.userId", operator: "equals", values: ["ABC-123"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("normalizes equals filters nested inside an or group", () => {
    const query = {
      measures: ["FeedbackRecords.count"],
      filters: [
        {
          or: [
            { member: "FeedbackRecords.sourceName", operator: "equals", values: ["After-Match"] },
            { member: "FeedbackRecords.sourceName", operator: "contains", values: ["Pre"] },
          ],
        },
      ],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      {
        or: [
          { member: "FeedbackRecords.sourceNameNormalized", operator: "equals", values: ["after-match"] },
          { member: "FeedbackRecords.sourceName", operator: "contains", values: ["Pre"] },
        ],
      },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] },
    ]);
  });

  test("logs sanitized Cube audit metadata without raw filter values", () => {
    queryRewrite(
      {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["secret-value"] }],
      },
      { securityContext }
    );

    const logPayload = vi.mocked(console.log).mock.calls[0][0];
    const parsed = JSON.parse(logPayload);
    expect(parsed).toMatchObject({
      type: "audit",
      event: "cube.query",
      status: "success",
      tenantId: "frd-1",
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      actor: { type: "user", id: "user-1" },
      requestId: "request-1",
      source: "v3.charts.data",
    });
    expect(parsed.members).toContain("FeedbackRecords.tenantId");
    expect(logPayload).not.toContain("secret-value");
  });

  // The Helm chart mounts charts/formbricks/cube/cube.js over the pod's config
  // (see charts/formbricks/templates/cube-configmap.yaml), so it must stay
  // byte-identical to the Docker copy this suite runs against — mirroring the
  // schema parity guard in schema-definition.test.ts.
  test("keeps the Helm and Docker Cube configs in sync", () => {
    expect(readFileSync(chartCubeConfigPath, "utf8")).toBe(readFileSync(cubeConfigPath, "utf8"));
  });

  test("rewrite map matches the *Normalized companion dimensions in the Cube schema", () => {
    const configSource = readFileSync(cubeConfigPath, "utf8");
    const schemaSource = readFileSync(cubeSchemaPath, "utf8");

    const mapEntries = [
      ...configSource.matchAll(/"FeedbackRecords\.(\w+)":\s*"FeedbackRecords\.(\w+)"/g),
    ].map(([, source, normalized]) => ({ source, normalized }));
    const schemaNormalizedDimensions = [...schemaSource.matchAll(/^ {6}(\w+Normalized): \{/gm)].map(
      ([, name]) => name
    );

    expect(mapEntries.length).toBeGreaterThan(0);
    for (const { source, normalized } of mapEntries) {
      expect(normalized).toBe(`${source}Normalized`);
    }
    expect(mapEntries.map(({ normalized }) => normalized).sort()).toEqual(
      [...schemaNormalizedDimensions].sort()
    );
  });
});

const TENANT_FILTER = { member: "FeedbackRecords.tenantId", operator: "equals", values: ["frd-1"] };
const ANSWER_KINDS = { q_delivery: "choice", q_feat: "multi", q_nps: "number", q_yn: "boolean" };
const answerContext = { securityContext: { ...securityContext, answerKinds: ANSWER_KINDS } };
const answer = (operator: string, values: string[]) => ({
  member: "FeedbackRecords.answer",
  operator,
  values,
});

describe("cube queryRewrite: answer filters (ENG-6894)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("expands a single-select rule onto its own alias, keyed on field_id and value_id", () => {
    const rewritten = queryRewrite(
      { measures: ["FeedbackRecords.npsScore"], filters: [answer("equals", ["q_delivery:opt_late"])] },
      answerContext
    );

    expect(rewritten.filters).toEqual([
      {
        and: [
          { member: "AnswerFilter1.fieldId", operator: "equals", values: ["q_delivery"] },
          { member: "AnswerFilter1.valueId", operator: "equals", values: ["opt_late"] },
        ],
      },
      TENANT_FILTER,
    ]);
  });

  test("keeps 'is not' on the answered question, so an unanswered submission never matches", () => {
    const rewritten = queryRewrite(
      { measures: ["FeedbackRecords.count"], filters: [answer("notEquals", ["q_delivery:opt_late"])] },
      answerContext
    );

    expect(rewritten.filters).toEqual([
      {
        and: [
          { member: "AnswerFilter1.fieldId", operator: "equals", values: ["q_delivery"] },
          { member: "AnswerFilter1.valueId", operator: "notEquals", values: ["opt_late"] },
        ],
      },
      TENANT_FILTER,
    ]);
  });

  test("maps multi-select 'contains' and 'is any of' to <question>__<option> on the field group", () => {
    const rewritten = queryRewrite(
      { measures: ["FeedbackRecords.count"], filters: [answer("equals", ["q_feat:opt_a", "q_feat:opt_c"])] },
      answerContext
    );

    expect(rewritten.filters).toEqual([
      {
        and: [
          { member: "AnswerFilter1.fieldGroupId", operator: "equals", values: ["q_feat"] },
          { member: "AnswerFilter1.fieldId", operator: "equals", values: ["q_feat__opt_a", "q_feat__opt_c"] },
        ],
      },
      TENANT_FILTER,
    ]);
  });

  test("puts number and yes/no rules on their typed columns", () => {
    const rewritten = queryRewrite(
      {
        measures: ["FeedbackRecords.count"],
        filters: [answer("equals", ["q_nps:9", "q_nps:10"]), answer("notEquals", ["q_yn:false"])],
      },
      answerContext
    );

    expect(rewritten.filters).toEqual([
      {
        and: [
          { member: "AnswerFilter1.fieldId", operator: "equals", values: ["q_nps"] },
          { member: "AnswerFilter1.valueNumber", operator: "equals", values: ["9", "10"] },
        ],
      },
      {
        and: [
          { member: "AnswerFilter2.fieldId", operator: "equals", values: ["q_yn"] },
          { member: "AnswerFilter2.valueBoolean", operator: "notEquals", values: ["false"] },
        ],
      },
      TENANT_FILTER,
    ]);
  });

  test("gives every rule its own alias through nested and/or groups, next to ordinary filters", () => {
    const rewritten = queryRewrite(
      {
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            or: [
              answer("equals", ["q_delivery:opt_late"]),
              {
                and: [
                  answer("equals", ["q_feat:opt_a"]),
                  { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
                ],
              },
            ],
          },
        ],
      },
      answerContext
    );

    expect(rewritten.filters).toEqual([
      {
        or: [
          {
            and: [
              { member: "AnswerFilter1.fieldId", operator: "equals", values: ["q_delivery"] },
              { member: "AnswerFilter1.valueId", operator: "equals", values: ["opt_late"] },
            ],
          },
          {
            and: [
              {
                and: [
                  { member: "AnswerFilter2.fieldGroupId", operator: "equals", values: ["q_feat"] },
                  { member: "AnswerFilter2.fieldId", operator: "equals", values: ["q_feat__opt_a"] },
                ],
              },
              { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
            ],
          },
        ],
      },
      TENANT_FILTER,
    ]);
  });

  test("allows exactly as many rules as there are aliases", () => {
    const rules = (count: number) =>
      Array.from({ length: count }, (_, index) => answer("equals", [`q_delivery:opt_${index}`]));
    const { ANSWER_FILTER_ALIAS_COUNT } = cubeConfig;

    const rewritten = queryRewrite(
      { measures: ["FeedbackRecords.count"], filters: rules(ANSWER_FILTER_ALIAS_COUNT) },
      answerContext
    );
    expect(JSON.stringify(rewritten.filters)).toContain(`AnswerFilter${ANSWER_FILTER_ALIAS_COUNT}.`);

    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"], filters: rules(ANSWER_FILTER_ALIAS_COUNT + 1) },
        answerContext
      )
    ).toThrow(/at most 25 answer rules/);
  });

  test.each([
    [
      "a question the token gives no kind for",
      [answer("equals", ["q_unknown:x"])],
      answerContext,
      /no known kind/,
    ],
    [
      "a token without answer kinds",
      [answer("equals", ["q_delivery:opt_late"])],
      { securityContext },
      /no known kind/,
    ],
    [
      "two questions in one rule",
      [answer("equals", ["q_delivery:a", "q_nps:9"])],
      answerContext,
      /exactly one question/,
    ],
    [
      "a value without a question",
      [answer("equals", ["opt_late"])],
      answerContext,
      /<questionId>:<valueKey>/,
    ],
    [
      "a value without a value key",
      [answer("equals", ["q_delivery:"])],
      answerContext,
      /<questionId>:<valueKey>/,
    ],
    ["no values", [answer("equals", [])], answerContext, /at least one value/],
    [
      "an operator other than equals/notEquals",
      [answer("contains", ["q_delivery:x"])],
      answerContext,
      /equals or notEquals/,
    ],
    [
      "multi-select 'does not contain'",
      [answer("notEquals", ["q_feat:opt_a"])],
      answerContext,
      /takes equals only/,
    ],
    ["a non-number on a number question", [answer("equals", ["q_nps:high"])], answerContext, /takes numbers/],
    [
      "anything but true/false on a yes/no question",
      [answer("equals", ["q_yn:yes"])],
      answerContext,
      /true or false/,
    ],
  ])("refuses %s", (_label, filters, context, error) => {
    expect(() => queryRewrite({ measures: ["FeedbackRecords.count"], filters }, context)).toThrow(error);
  });

  test("takes the question id up to the first colon, so value keys may contain one", () => {
    const rewritten = queryRewrite(
      { measures: ["FeedbackRecords.count"], filters: [answer("equals", ["q_delivery:opt:with:colons"])] },
      answerContext
    );

    expect(JSON.stringify(rewritten.filters)).toContain('"values":["opt:with:colons"]');
  });

  test.each([
    [
      "an answer-filter alias",
      {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "AnswerFilter3.valueId", operator: "equals", values: ["x"] }],
      },
    ],
    [
      "an embedded equals twin",
      {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.edc_plan_64879f7d", operator: "notEquals", values: ["x"] }],
      },
    ],
    [
      "the answer member as a dimension",
      { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.answer"] },
    ],
    [
      "the answer member in an order",
      { measures: ["FeedbackRecords.count"], order: [["FeedbackRecords.answer", "asc"]] },
    ],
  ])("refuses %s, which only the rewrite may write", (_label, query) => {
    expect(() => queryRewrite(query, answerContext)).toThrow(/reserved member|filter only/);
  });

  test("leaves a query without answer rules exactly as before", () => {
    const query = {
      measures: ["FeedbackRecords.npsScore"],
      dimensions: ["FeedbackRecords.sourceName"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
        { or: [{ member: "FeedbackRecords.valueNumber", operator: "gte", values: ["9"] }] },
      ],
    };

    expect(queryRewrite(query, answerContext)).toEqual({
      ...query,
      filters: [...query.filters, TENANT_FILTER],
    });
  });
});

describe("cube embedded-data members (ENG-6893)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const specsFor = (edKeys: unknown) =>
    cubeConfig.getEmbeddedDimensionSpecs({ securityContext: { ...securityContext, edKeys } });

  test("compiles no member for a dataset without keys", () => {
    expect(specsFor(undefined)).toEqual([]);
    expect(specsFor([])).toEqual([]);
    expect(specsFor("plan")).toEqual([]);
  });

  test("names each key ed_<slug>_<hash>, keeping keys that slug alike apart", () => {
    const names = specsFor(["plan", "Plan", "plan ", "área manager", "Area-Manager"]).map((spec) => [
      spec.key,
      spec.name,
    ]);

    expect(names).toEqual([
      ["Area-Manager", expect.stringMatching(/^ed_area_manager_[0-9a-f]{8}$/)],
      ["Plan", expect.stringMatching(/^ed_plan_[0-9a-f]{8}$/)],
      ["plan", "ed_plan_64879f7d"],
      ["plan ", expect.stringMatching(/^ed_plan_[0-9a-f]{8}$/)],
      ["área manager", expect.stringMatching(/^ed_area_manager_[0-9a-f]{8}$/)],
    ]);
    expect(new Set(names.map(([, name]) => name)).size).toBe(5);
  });

  test("names a key with no ASCII letters or digits by its hash alone", () => {
    const [spec] = specsFor(["区域 🎉"]);
    expect(spec.name).toMatch(/^ed_[0-9a-f]{8}$/);
    expect(spec.equalsName).toBe(spec.name.replace(/^ed_/, "edc_"));
  });

  test("drops blank keys, keys over 128 characters, non-strings and duplicates, and caps at 100", () => {
    expect(
      specsFor(["", "   ", "x".repeat(129), 7, null, "ok", "ok", "y".repeat(128)]).map((spec) => spec.key)
    ).toEqual(["ok", "y".repeat(128)]);

    const many = Array.from({ length: 150 }, (_, index) => `key_${String(index).padStart(3, "0")}`);
    const specs = specsFor(many);
    expect(specs).toHaveLength(100);
    // The first 100 the token lists win, so the app's frequency order decides which keys are kept.
    expect(specs.map((spec) => spec.key)).toEqual(many.slice(0, 100));
  });

  test("writes keys into SQL as escaped literals only", () => {
    const awkward = [
      "O'Brien's",
      "$1$",
      "a?b",
      "${CUBE}",
      "back\\slash",
      "区域",
      "🎉",
      "x'); DROP TABLE x; --",
    ];
    for (const key of awkward) {
      const literal = cubeConfig.toSafeSqlStringLiteral(key);
      expect(literal).toMatch(/^E'[A-Za-z0-9 _\\-]*'$/);
      expect(literal.slice(2, -1)).not.toMatch(/['$?{}]/);
    }
    expect(cubeConfig.toSafeSqlStringLiteral("O'Brien $1$")).toBe("E'O\\u0027Brien \\u00241\\u0024'");
    expect(cubeConfig.toSafeSqlStringLiteral("🎉")).toBe("E'\\U0001f389'");
    expect(specsFor(["$1$"])[0].valueSql).toBe("metadata->'embedded_data'->>E'\\u00241\\u0024'");
  });

  test("narrows equals filters with a containment predicate that also matches numbers and booleans", () => {
    const sql = cubeConfig.getEmbeddedContainmentSql("E'seats'", ["$0$", "$1$"]);

    expect(sql).toContain("metadata->'embedded_data' @> jsonb_build_object(E'seats', $0$::text)");
    expect(sql).toContain("($1$::text)::numeric");
    expect(sql).toContain("($1$::text)::boolean");
    expect(cubeConfig.getEmbeddedContainmentSql("E'seats'", [])).toBe("1 = 1");
  });

  test("moves only equals on an embedded member onto its containment twin", () => {
    const rewritten = queryRewrite(
      {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.ed_plan_64879f7d"],
        filters: [
          { member: "FeedbackRecords.ed_plan_64879f7d", operator: "equals", values: ["Pro"] },
          {
            or: [
              { member: "FeedbackRecords.ed_region_0a1b2c3d", operator: "notEquals", values: ["North"] },
              { member: "FeedbackRecords.ed_region_0a1b2c3d", operator: "equals", values: ["South"] },
            ],
          },
          { member: "FeedbackRecords.ed_plan_64879f7d", operator: "contains", values: ["Pr"] },
        ],
      },
      { securityContext }
    );

    expect(rewritten.dimensions).toEqual(["FeedbackRecords.ed_plan_64879f7d"]);
    expect(rewritten.filters).toEqual([
      // Exact-case: an embedded value is matched as collected, never lowercased.
      { member: "FeedbackRecords.edc_plan_64879f7d", operator: "equals", values: ["Pro"] },
      {
        or: [
          { member: "FeedbackRecords.ed_region_0a1b2c3d", operator: "notEquals", values: ["North"] },
          { member: "FeedbackRecords.edc_region_0a1b2c3d", operator: "equals", values: ["South"] },
        ],
      },
      { member: "FeedbackRecords.ed_plan_64879f7d", operator: "contains", values: ["Pr"] },
      TENANT_FILTER,
    ]);
  });

  test("compiles one model per dataset and key set, and shares the plain one", () => {
    const appId = (extra: Record<string, unknown>) =>
      cubeConfig.contextToAppId({ securityContext: { ...securityContext, ...extra } });

    expect(appId({})).toBe("FB_BASE");
    expect(appId({ edKeys: ["", "   "] })).toBe("FB_BASE");
    expect(cubeConfig.contextToAppId({})).toBe("FB_BASE");
    expect(appId({ edKeys: ["plan", "region"] })).toMatch(/^FB_ED_[0-9a-f]{32}$/);
    // Order does not matter, the key set does; and so does the dataset.
    expect(appId({ edKeys: ["region", "plan"] })).toBe(appId({ edKeys: ["plan", "region"] }));
    expect(appId({ edKeys: ["plan"] })).not.toBe(appId({ edKeys: ["plan", "region"] }));
    expect(appId({ edKeys: ["plan"], tenantId: "frd-2", feedbackDirectoryId: "frd-2" })).not.toBe(
      appId({ edKeys: ["plan"] })
    );
    // An answer-kind claim is per query and must not fork the model.
    expect(appId({ edKeys: ["plan"], answerKinds: ANSWER_KINDS })).toBe(appId({ edKeys: ["plan"] }));
  });

  test("bounds the compiled-model cache unless the operator set it", () => {
    expect(cubeConfig.compilerCacheSize).toBe(150);
    expect(cubeConfig.maxCompiledMembers).toBe(75_000);
    // Cube validates its options strictly: the model's helpers must not be enumerable options.
    expect(Object.keys(cubeConfig).sort()).toEqual([
      "compilerCacheSize",
      "contextToAppId",
      "maxCompiledMembers",
      "queryRewrite",
    ]);
  });

  test("the schema joins exactly as many AnswerFilter aliases as the rewrite numbers", () => {
    const schemaSource = readFileSync(cubeSchemaPath, "utf8");
    const joined = [...schemaSource.matchAll(/^ {6}AnswerFilter(\d+): \{$/gm)].map(([, index]) =>
      Number(index)
    );

    expect(joined).toEqual(
      Array.from({ length: cubeConfig.ANSWER_FILTER_ALIAS_COUNT }, (_, index) => index + 1)
    );
  });
});
