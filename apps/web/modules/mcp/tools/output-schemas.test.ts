import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ZMcpListMeta, mcpToolOutput } from "./output-schemas";

/**
 * The SDK validates every successful result against the schema a tool advertised. These are the `meta`
 * objects the v3 list operations really emit (the file named beside each one), so a schema stricter than
 * what an operation answers fails here instead of failing every call to that tool.
 */
const EMITTED_META = {
  "keyset page (lib/list-resource.ts, segments, contacts, audit-events, creatives)": {
    limit: 50,
    nextCursor: null,
  },
  "survey list (surveys/lib/operations.ts)": {
    limit: 50,
    nextCursor: "abc",
    totalCount: 3,
    workspaceSurveyCount: 4,
  },
  "response list (responses/lib/operations.ts)": {
    limit: 50,
    nextCursor: null,
    totalCount: null,
    totalCountRelation: null,
  },
  "counted list (teams and members)": {
    limit: 200,
    nextCursor: null,
    totalCount: 7,
    totalCountRelation: "gte",
  },
  "feedback datasets (feedbackRecords/lib/operations.ts)": { nextCursor: null, totalCount: 2 },
  "taxonomy node records (unify-feedback/taxonomy)": { limit: 50 },
  "feedback record search (feedbackRecords/lib/operations.ts)": {
    limit: 50,
    nextCursor: null,
    minScore: 0.5,
    datasetId: "d1",
    datasetName: "Support",
  },
} as const;

describe("list meta in tool output", () => {
  const output = mcpToolOutput(z.array(z.unknown())) as unknown as {
    "~standard": { validate: (value: unknown) => Promise<{ issues?: unknown[] }> };
  };

  test.each(Object.entries(EMITTED_META))("accepts the %s", async (_name, meta) => {
    expect((await output["~standard"].validate({ data: [], meta, requestId: "r" })).issues).toBeUndefined();
  });

  test("still refuses a key typed wrongly", () => {
    expect(ZMcpListMeta.safeParse({ limit: "50" }).success).toBe(false);
    expect(ZMcpListMeta.safeParse({ nextCursor: 3 }).success).toBe(false);
    expect(ZMcpListMeta.safeParse({ totalCountRelation: "approx" }).success).toBe(false);
  });
});
