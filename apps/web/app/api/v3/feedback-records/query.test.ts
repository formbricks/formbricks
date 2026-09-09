import { describe, expect, test } from "vitest";
import {
  ZV3FeedbackRecordsCountQuery,
  ZV3FeedbackRecordsListQuery,
  respellProblemParams,
  toOperationFilters,
  toOperationSort,
  translateCreateBody,
  translateUpdateBody,
} from "./query";

const WORKSPACE_ID = "clz1a2b3c4d5e6f7g8h9i0j1";

/** The wrapper hands Zod one string per parameter, or an array when the parameter repeats. */
const parseList = (params: Record<string, string | string[]>) =>
  ZV3FeedbackRecordsListQuery.safeParse({ workspaceId: WORKSPACE_ID, ...params });

describe("documented filters translate to operation parameters", () => {
  test("every documented filter reaches the operations layer", () => {
    const parsed = parseList({
      "filter[sourceType][in]": "survey",
      "filter[sourceId][in]": ["s1", "s2"],
      "filter[sourceName][in]": "App Store",
      "filter[fieldType][in]": "text",
      "filter[fieldId][in]": "q1",
      "filter[fieldGroupId][in]": "g1",
      "filter[submissionId][in]": "sub1",
      "filter[userId][in]": "u1",
      "filter[valueId][in]": "choice_1",
      "filter[language][in]": "en",
      "filter[sentiment][in]": "negative",
      "filter[emotions][in]": "anger",
      "filter[collectedAt][gte]": "2026-08-01T00:00:00Z",
      "filter[collectedAt][lte]": "2026-08-31T00:00:00Z",
      "filter[createdAt][gte]": "2026-08-01T00:00:00Z",
      "filter[createdAt][lte]": "2026-08-31T00:00:00Z",
      "filter[valueDate][gte]": "2026-01-01T00:00:00Z",
      "filter[valueDate][lte]": "2026-12-31T00:00:00Z",
      "filter[valueNumber][gte]": "1",
      "filter[valueNumber][lte]": "10",
      "filter[sentimentScore][gte]": "-0.5",
      "filter[sentimentScore][lte]": "0.5",
      "filter[hasSentiment][eq]": "true",
      "filter[hasEmotions][eq]": "false",
      "filter[hasTranslation][eq]": "true",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(toOperationFilters(parsed.data)).toEqual({
      source_type: "survey",
      source_id: ["s1", "s2"],
      source_name: "App Store",
      field_type: "text",
      field_id: "q1",
      field_group_id: "g1",
      submission_id: "sub1",
      user_id: "u1",
      value_id: "choice_1",
      language: "en",
      sentiment: "negative",
      emotions: "anger",
      since: "2026-08-01T00:00:00Z",
      until: "2026-08-31T00:00:00Z",
      created_since: "2026-08-01T00:00:00Z",
      created_until: "2026-08-31T00:00:00Z",
      value_date_min: "2026-01-01T00:00:00Z",
      value_date_max: "2026-12-31T00:00:00Z",
      value_number_min: 1,
      value_number_max: 10,
      sentiment_score_min: -0.5,
      sentiment_score_max: 0.5,
      has_sentiment: true,
      has_emotions: false,
      has_translation: true,
    });
  });

  test("an unsent filter is omitted rather than sent as undefined", () => {
    const parsed = parseList({ "filter[userId][in]": "u1" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(toOperationFilters(parsed.data))).toEqual(["user_id"]);
  });
});

describe("enum values are translated, data values are not", () => {
  test.each([
    ["veryNegative", "very_negative"],
    ["veryPositive", "very_positive"],
    ["negative", "negative"],
    ["mixed", "mixed"],
  ])("sentiment %s becomes %s", (v3, hub) => {
    const parsed = parseList({ "filter[sentiment][in]": v3 });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationFilters(parsed.data).sentiment).toBe(hub);
  });

  test("all six sentiment labels are accepted", () => {
    for (const label of ["veryNegative", "negative", "neutral", "positive", "veryPositive", "mixed"]) {
      expect(parseList({ "filter[sentiment][in]": label }).success).toBe(true);
    }
  });

  test("the Hub's own spelling is rejected, so the two vocabularies cannot be mixed", () => {
    expect(parseList({ "filter[sentiment][in]": "very_negative" }).success).toBe(false);
  });

  test("a repeated sentiment filter translates every value", () => {
    const parsed = parseList({ "filter[sentiment][in]": ["veryNegative", "negative"] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationFilters(parsed.data).sentiment).toEqual(["very_negative", "negative"]);
  });

  /**
   * `sourceType` and `userId` carry values we were given, not vocabulary we define. Re-casing or
   * splitting them would corrupt data — a source really can be named "Acme, Inc.".
   */
  test("a comma in a filter value is one value, not two", () => {
    const parsed = parseList({ "filter[sourceName][in]": "Acme, Inc." });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationFilters(parsed.data).source_name).toBe("Acme, Inc.");
  });

  test("an underscored data value is passed through untouched", () => {
    const parsed = parseList({ "filter[sourceType][in]": "feedback_form" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationFilters(parsed.data).source_type).toBe("feedback_form");
  });
});

describe("scalars are coerced, not guessed", () => {
  test.each([
    ["true", true],
    ["false", false],
  ])("a presence filter of %s becomes %s", (raw, expected) => {
    const parsed = parseList({ "filter[hasEmotions][eq]": raw });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationFilters(parsed.data).has_emotions).toBe(expected);
  });

  test.each(["1", "yes", "False", ""])("a presence filter of %o is rejected", (raw) => {
    expect(parseList({ "filter[hasEmotions][eq]": raw }).success).toBe(false);
  });

  test("a non-numeric bound is rejected rather than becoming NaN", () => {
    expect(parseList({ "filter[valueNumber][gte]": "abc" }).success).toBe(false);
  });

  test.each(["-1.5", "1.5"])("a sentiment score of %s is out of range", (raw) => {
    expect(parseList({ "filter[sentimentScore][gte]": raw }).success).toBe(false);
  });

  test("an empty filter value is rejected rather than ignored", () => {
    expect(parseList({ "filter[userId][in]": "" }).success).toBe(false);
  });
});

describe("pagination and ordering", () => {
  /**
   * Deliberately left unset here: `DEFAULT_LIST_LIMIT` in the operations layer applies it, and that is
   * the path the MCP tools take too. A default here as well would answer the same request differently
   * depending on which surface asked.
   */
  test("limit is left for the operations layer to default", () => {
    const parsed = parseList({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.limit).toBeUndefined();
  });

  test.each(["0", "-5", "1001", "abc", "1.5"])("a limit of %s is rejected", (raw) => {
    expect(parseList({ limit: raw }).success).toBe(false);
  });

  test("limit accepts the documented ceiling", () => {
    const parsed = parseList({ limit: "1000" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.limit).toBe(1000);
  });

  test("sortBy defaults to the newest feedback first", () => {
    const parsed = parseList({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sortBy).toBe("-collectedAt");
    expect(toOperationSort(parsed.data.sortBy)).toEqual({ sort: "collected_at", order: "desc" });
  });

  test.each([
    ["collectedAt", { sort: "collected_at", order: "asc" }],
    ["-collectedAt", { sort: "collected_at", order: "desc" }],
    ["createdAt", { sort: "created_at", order: "asc" }],
    ["-createdAt", { sort: "created_at", order: "desc" }],
  ])("sortBy %s splits into %o", (sortBy, expected) => {
    const parsed = parseList({ sortBy });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toOperationSort(parsed.data.sortBy)).toEqual(expected);
  });

  test.each(["collected_at", "-createdat", "collectedAt,createdAt", "updatedAt"])(
    "an undocumented sortBy of %s is rejected",
    (sortBy) => {
      expect(parseList({ sortBy }).success).toBe(false);
    }
  );
});

describe("the query string is closed", () => {
  test("an internal parameter name is not accepted from the wire", () => {
    expect(parseList({ user_id: "u1" }).success).toBe(false);
  });

  test("a misspelled filter is a validation failure, not a silent no-op", () => {
    expect(parseList({ "filter[userID][in]": "u1" }).success).toBe(false);
  });

  test("an unsupported operator on a real member is rejected", () => {
    expect(parseList({ "filter[userId][eq]": "u1" }).success).toBe(false);
  });

  test("workspaceId is required", () => {
    expect(ZV3FeedbackRecordsListQuery.safeParse({}).success).toBe(false);
  });

  /** Counting takes the filters but no pagination: the Hub's count endpoint rejects ordering. */
  test.each(["limit", "cursor", "sortBy"])("count rejects the pagination parameter %s", (param) => {
    expect(ZV3FeedbackRecordsCountQuery.safeParse({ workspaceId: WORKSPACE_ID, [param]: "1" }).success).toBe(
      false
    );
  });
});

describe("invalid_params names what the caller sent", () => {
  test("a bad filter is reported by its documented name, never its internal one", () => {
    const parsed = parseList({ "filter[sentimentScore][gte]": "5" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].path.join(".")).toBe("filter[sentimentScore][gte]");
  });
});

describe("request bodies translate to operation parameters", () => {
  test("the documented create body reaches the operations layer in its own spelling", () => {
    const result = translateCreateBody({
      sourceType: "review",
      sourceName: "App Store",
      submissionId: "sub-1",
      fieldId: "review_body",
      fieldLabel: "Review",
      fieldGroupId: "g1",
      fieldGroupLabel: "Group",
      fieldType: "text",
      valueText: "Crashes on checkout.",
      valueId: "choice_1",
      valueNumber: 9,
      valueBoolean: true,
      valueDate: "2026-08-15T10:30:00Z",
      userId: "u-1",
      language: "en",
      collectedAt: "2026-08-15T10:30:00Z",
      sourceId: "s-1",
      metadata: { plan: "pro" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toEqual({
      source_type: "review",
      source_name: "App Store",
      submission_id: "sub-1",
      field_id: "review_body",
      field_label: "Review",
      field_group_id: "g1",
      field_group_label: "Group",
      field_type: "text",
      value_text: "Crashes on checkout.",
      value_id: "choice_1",
      value_number: 9,
      value_boolean: true,
      value_date: "2026-08-15T10:30:00Z",
      user_id: "u-1",
      language: "en",
      collected_at: "2026-08-15T10:30:00Z",
      source_id: "s-1",
      metadata: { plan: "pro" },
    });
  });

  /** Caller-owned JSON: re-spelling anything inside it would corrupt data we were asked to store. */
  test("metadata keys are left exactly as sent", () => {
    const result = translateCreateBody({
      sourceType: "review",
      submissionId: "s",
      fieldId: "f",
      fieldType: "text",
      metadata: { userAgent: "x", nested: { deepKey: 1 }, snake_key: 2 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.metadata).toEqual({ userAgent: "x", nested: { deepKey: 1 }, snake_key: 2 });
  });

  /**
   * The failure ENG-2256 found on the batch tool, at the REST boundary: a dropped field means a record
   * stored without the text or the attribution the caller sent, reported as success.
   */
  test("a misspelled field is rejected and named as it was sent", () => {
    const result = translateCreateBody({ sourceType: "review", valueTxt: "typo" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalidParams.map((p) => p.name)).toEqual(["valueTxt"]);
    expect(result.invalidParams[0].reason).toContain("valueText");
  });

  test("an internal spelling is not accepted from the wire either", () => {
    const result = translateCreateBody({ source_type: "review" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalidParams.map((p) => p.name)).toEqual(["source_type"]);
  });

  test.each([null, [], "text", 42])("a body of %o is refused as not an object", (body) => {
    const result = translateCreateBody(body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalidParams[0].name).toBe("body");
  });

  /** The update body is the mutable subset: provenance is corrected by delete-and-recreate. */
  test.each(["sourceType", "fieldId", "submissionId", "collectedAt", "fieldType"])(
    "update rejects the immutable field %s",
    (field) => {
      const result = translateUpdateBody({ [field]: "x" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.invalidParams.map((p) => p.name)).toEqual([field]);
    }
  );

  test("update accepts every documented mutable field", () => {
    const result = translateUpdateBody({
      valueText: "corrected",
      valueNumber: 1,
      valueBoolean: false,
      valueDate: "2026-08-15T10:30:00Z",
      valueId: "c1",
      userId: "u1",
      language: "en",
      metadata: { a: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.body).sort()).toEqual([
      "language",
      "metadata",
      "user_id",
      "value_boolean",
      "value_date",
      "value_id",
      "value_number",
      "value_text",
    ]);
  });
});

describe("a validation problem names what the caller sent", () => {
  const problem = (invalidParams: { name: string; reason: string }[]) =>
    new Response(JSON.stringify({ title: "Unprocessable Content", invalid_params: invalidParams }), {
      status: 422,
      headers: { "Content-Type": "application/problem+json" },
    });

  test("internal field names are re-spelled on the way out", async () => {
    const res = await respellProblemParams(
      problem([
        { name: "value_text", reason: "too long" },
        { name: "field_group_label", reason: "expected string" },
      ])
    );
    expect(res.status).toBe(422);
    expect((await res.json()).invalid_params.map((p: { name: string }) => p.name)).toEqual([
      "valueText",
      "fieldGroupLabel",
    ]);
  });

  test("a response that is not a validation problem is passed through untouched", async () => {
    const original = new Response(JSON.stringify({ data: { value_text: "kept" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const res = await respellProblemParams(original);
    expect(res).toBe(original);
    expect((await res.json()).data.value_text).toBe("kept");
  });

  test("a 422 carrying no invalid_params is left alone", async () => {
    const res = await respellProblemParams(
      new Response(JSON.stringify({ title: "Unprocessable Content" }), {
        status: 422,
        headers: { "Content-Type": "application/problem+json" },
      })
    );
    expect(await res.json()).toEqual({ title: "Unprocessable Content" });
  });
});
