import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const { queryRewrite } = require("../../../../../../../docker/cube/cube.js") as {
  queryRewrite: (
    query: Record<string, unknown>,
    context: { securityContext?: Record<string, unknown> }
  ) => Record<string, unknown>;
};

const securityContext = {
  tenantId: "workspace-1",
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

  test("rejects tenantId and workspaceId claim mismatches", () => {
    expect(() =>
      queryRewrite(
        { measures: ["FeedbackRecords.count"] },
        { securityContext: { ...securityContext, tenantId: "workspace-2" } }
      )
    ).toThrow(/tenantId\/workspaceId mismatch/);
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
                { member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
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
      filters: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] }],
    };

    const rewrittenQuery = queryRewrite(query, { securityContext });

    expect(rewrittenQuery.filters).toEqual([
      { member: "FeedbackRecords.sentiment", operator: "equals", values: ["positive"] },
      { member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-1"] },
    ]);
    expect(query.filters).toHaveLength(1);
  });

  test("logs sanitized Cube audit metadata without raw filter values", () => {
    queryRewrite(
      {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["secret-value"] }],
      },
      { securityContext }
    );

    const logPayload = vi.mocked(console.log).mock.calls[0][0];
    const parsed = JSON.parse(logPayload);
    expect(parsed).toMatchObject({
      type: "audit",
      event: "cube.query",
      tenantId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      requestId: "request-1",
      source: "charts.executeQueryAction",
    });
    expect(parsed.members).toContain("FeedbackRecords.tenantId");
    expect(logPayload).not.toContain("secret-value");
  });
});
