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
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filterCriteria={}`), {
      sessionUserId: "u1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid_params[0].name).toBe("filterCriteria");
  });

  test("rejects unknown query parameters", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&foo=bar`), {
      sessionUserId: "u1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.invalid_params[0]).toEqual({
        name: "foo",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, name, status, type, createdBy, sortBy.",
      });
  });

  test("rejects the legacy after query parameter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&after=legacy-cursor`), {
      sessionUserId: "u1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "after",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, name, status, type, createdBy, sortBy.",
      });
    }
  });

  test("parses minimal query", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}`), { sessionUserId: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limit).toBe(20);
      expect(r.cursor).toBeNull();
      expect(r.sortBy).toBe("updatedAt");
      expect(r.filterCriteria).toBeUndefined();
    }
  });

  test("builds filter from flat params and sets createdBy.userId from session", () => {
    const r = parseV3SurveysListQuery(
      params(
        `workspaceId=${wid}&name=Foo&status=inProgress&status=draft&type=link&createdBy=you&sortBy=updatedAt`
      ),
      { sessionUserId: "session_user" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filterCriteria).toEqual({
        name: "Foo",
        status: ["inProgress", "draft"],
        type: ["link"],
        createdBy: { userId: "session_user", value: ["you"] },
      });
      expect(r.sortBy).toBe("updatedAt");
    }
  });

  test("invalid status", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&status=notastatus`), {
      sessionUserId: "u1",
    });
    expect(r.ok).toBe(false);
  });

  test("createdBy not allowed without session user", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&createdBy=you`), {
      sessionUserId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid_params[0].name).toBe("createdBy");
  });

  test("rejects an invalid cursor", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&cursor=not-a-real-cursor`), {
      sessionUserId: "u1",
    });
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
