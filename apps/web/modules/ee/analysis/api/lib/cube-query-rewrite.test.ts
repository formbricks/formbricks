import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const cubeConfigPath = require.resolve("../../../../../../../docker/cube/cube.js");
const chartCubeConfigPath = require.resolve("../../../../../../../charts/formbricks/cube/cube.js");
const cubeSchemaPath = require.resolve("../../../../../../../docker/cube/schema/FeedbackRecords.js");
process.env.CUBEJS_API_SECRET = process.env.CUBEJS_API_SECRET || "cube-secret";

const { queryRewrite } = require(cubeConfigPath) as {
  queryRewrite: (
    query: Record<string, unknown>,
    context: { securityContext?: Record<string, unknown> }
  ) => Record<string, unknown>;
};

const securityContext = {
  tenantId: "frd-1",
  feedbackDirectoryId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  userId: "user-1",
  scope: "xm:cube:query",
  source: "charts.executeQueryAction",
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
      userId: "user-1",
      requestId: "request-1",
      source: "charts.executeQueryAction",
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
      userId: "user-1",
      requestId: "request-1",
      source: "charts.executeQueryAction",
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
    const schemaNormalizedDimensions = [...schemaSource.matchAll(/^ {4}(\w+Normalized): \{/gm)].map(
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
