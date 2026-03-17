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
  test("rejects filterCriteria", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filterCriteria={}`), "u1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid_params[0].name).toBe("filterCriteria");
  });

  test("parses minimal query", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}`), "u1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limit).toBe(20);
      expect(r.offset).toBe(0);
      expect(r.filterCriteria).toBeUndefined();
    }
  });

  test("builds filter from flat params and sets createdBy.userId from session", () => {
    const r = parseV3SurveysListQuery(
      params(
        `workspaceId=${wid}&name=Foo&status=inProgress&status=draft&type=link&createdBy=you&sortBy=updatedAt`
      ),
      "session_user"
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filterCriteria).toEqual({
        name: "Foo",
        status: ["inProgress", "draft"],
        type: ["link"],
        createdBy: { userId: "session_user", value: ["you"] },
        sortBy: "updatedAt",
      });
    }
  });

  test("invalid status", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&status=notastatus`), "u1");
    expect(r.ok).toBe(false);
  });
});
