import { describe, expect, test } from "vitest";
import { collectMultiValueQueryParam, parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";

const wid = "clxx1234567890123456789012";

function params(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe("collectMultiValueQueryParam", () => {
  test("merges repeated keys and comma-separated values", () => {
    const sp = params("status=draft&status=inProgress&type=link,app");
    expect(collectMultiValueQueryParam(sp, "status")).toEqual(["draft", "inProgress"]);
    expect(collectMultiValueQueryParam(sp, "type")).toEqual(["link", "app"]);
  });

  test("dedupes", () => {
    const sp = params("status=draft&status=draft");
    expect(collectMultiValueQueryParam(sp, "status")).toEqual(["draft"]);
  });
});

describe("parseV3SurveysListQuery", () => {
  test("rejects unsupported query parameters like filterCriteria", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filterCriteria={}`));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid_params[0].name).toBe("filterCriteria");
  });

  test("rejects unknown query parameters", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&foo=bar`));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.invalid_params[0]).toEqual({
        name: "foo",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, filter[name][contains], filter[status][in], filter[type][in], sortBy.",
      });
  });

  test("rejects the legacy after query parameter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&after=legacy-cursor`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "after",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, filter[name][contains], filter[status][in], filter[type][in], sortBy.",
      });
    }
  });

  test("rejects the legacy flat name query parameter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&name=Foo`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "name",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, filter[name][contains], filter[status][in], filter[type][in], sortBy.",
      });
    }
  });

  test("parses minimal query", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}`));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limit).toBe(20);
      expect(r.cursor).toBeNull();
      expect(r.sortBy).toBe("updatedAt");
      expect(r.filterCriteria).toBeUndefined();
    }
  });

  test("builds filter from explicit operator params", () => {
    const r = parseV3SurveysListQuery(
      params(
        `workspaceId=${wid}&filter[name][contains]=Foo&filter[status][in]=inProgress&filter[status][in]=draft&filter[type][in]=link&sortBy=updatedAt`
      )
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filterCriteria).toEqual({
        name: "Foo",
        status: ["inProgress", "draft"],
        type: ["link"],
      });
      expect(r.sortBy).toBe("updatedAt");
    }
  });

  test("invalid status", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[status][in]=notastatus`));
    expect(r.ok).toBe(false);
  });

  test("rejects the createdBy filter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[createdBy][in]=you`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "filter[createdBy][in]",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, filter[name][contains], filter[status][in], filter[type][in], sortBy.",
      });
    }
  });

  test("rejects an invalid cursor", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&cursor=not-a-real-cursor`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params).toEqual([
        {
          name: "cursor",
          reason: "The cursor is invalid.",
        },
      ]);
    }
  });
});
