import { describe, expect, test } from "vitest";
import { encodeSurveyListPageCursor } from "@/modules/survey/list/lib/survey-page";
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
          "Unsupported query parameter. Use only workspaceId, limit, cursor, includeTotalCount, filter[name][contains], filter[status][in], filter[type][in], filter[visibility][in], filter[owner][in], filter[singleUse][eq], filter[pinProtected][eq], sortBy, view.",
      });
  });

  test("rejects the legacy after query parameter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&after=legacy-cursor`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "after",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, includeTotalCount, filter[name][contains], filter[status][in], filter[type][in], filter[visibility][in], filter[owner][in], filter[singleUse][eq], filter[pinProtected][eq], sortBy, view.",
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
          "Unsupported query parameter. Use only workspaceId, limit, cursor, includeTotalCount, filter[name][contains], filter[status][in], filter[type][in], filter[visibility][in], filter[owner][in], filter[singleUse][eq], filter[pinProtected][eq], sortBy, view.",
      });
    }
  });

  test("parses minimal query", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}`));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limit).toBe(20);
      expect(r.cursor).toBeNull();
      expect(r.includeTotalCount).toBe(true);
      expect(r.sortBy).toBe("updatedAt");
      expect(r.view).toBe("summary");
      expect(r.filterCriteria).toBeUndefined();
    }
  });

  describe("view (ENG-6861)", () => {
    test("parses view=full and view=summary", () => {
      const full = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=full`));
      expect(full.ok && full.view).toBe("full");
      const summary = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=summary`));
      expect(summary.ok && summary.view).toBe("summary");
    });

    test("rejects an unknown view", () => {
      const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=detail`));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.invalid_params[0].name).toBe("view");
    });

    test("caps limit at the full-view maximum, and only for view=full", () => {
      const atCap = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=full&limit=50`));
      expect(atCap.ok && atCap.limit).toBe(50);

      const overCap = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=full&limit=51`));
      expect(overCap).toEqual({
        ok: false,
        invalid_params: [{ name: "limit", reason: "With view=full, limit must be at most 50." }],
      });

      const summary = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=summary&limit=51`));
      expect(summary.ok && summary.limit).toBe(51);
    });

    test("rejects lang: the list returns every configured language", () => {
      const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=full&lang=de-DE`));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.invalid_params[0].name).toBe("lang");
    });

    test("keeps the default limit for view=full", () => {
      const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&view=full`));
      expect(r.ok && r.limit).toBe(20);
    });
  });

  /**
   * The surveys list has its own `V3_SURVEYS_MAX_LIMIT`, raised alongside the shared v3 cap. Nothing
   * else in this file exercises the limit beyond its default of 20, so without these two the raise
   * is unpinned and reverting it keeps the suite green.
   */
  test("accepts the maximum limit and rejects one above it", () => {
    const ok = parseV3SurveysListQuery(params(`workspaceId=${wid}&limit=250`));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.limit).toBe(250);

    expect(parseV3SurveysListQuery(params(`workspaceId=${wid}&limit=251`)).ok).toBe(false);
  });

  test("parses includeTotalCount=false", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&includeTotalCount=false`));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.includeTotalCount).toBe(false);
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

  test("maps the single-use and PIN filters to booleans in the filter criteria", () => {
    const r = parseV3SurveysListQuery(
      params(`workspaceId=${wid}&filter[singleUse][eq]=false&filter[pinProtected][eq]=true`)
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.filterCriteria).toEqual({ singleUse: false, pinProtected: true });
  });

  test("rejects a single-use or PIN filter that is not true or false", () => {
    for (const qs of ["filter[singleUse][eq]=no", "filter[pinProtected][eq]=1"]) {
      const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&${qs}`));
      expect(r.ok).toBe(false);
    }
  });

  test("invalid status", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[status][in]=notastatus`));
    expect(r.ok).toBe(false);
  });

  test("maps the 'archived' pseudo-status to includeArchived and keeps real statuses", () => {
    const r = parseV3SurveysListQuery(
      params(`workspaceId=${wid}&filter[status][in]=inProgress&filter[status][in]=archived`)
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filterCriteria).toEqual({
        status: ["inProgress"],
        includeArchived: true,
      });
    }
  });

  test("maps a lone 'archived' status to includeArchived without a status filter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[status][in]=archived`));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filterCriteria).toEqual({ includeArchived: true });
    }
  });

  test("rejects the createdBy filter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[createdBy][in]=you`));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.invalid_params[0]).toEqual({
        name: "filter[createdBy][in]",
        reason:
          "Unsupported query parameter. Use only workspaceId, limit, cursor, includeTotalCount, filter[name][contains], filter[status][in], filter[type][in], filter[visibility][in], filter[owner][in], filter[singleUse][eq], filter[pinProtected][eq], sortBy, view.",
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

  /** Postgres `text` cannot hold U+0000; let through, the code fails the query and answers 500 (ENG-3550). */
  test("rejects a NULL byte in the name filter", () => {
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&filter[name][contains]=a%00b`));
    expect(r).toEqual({
      ok: false,
      invalid_params: [{ name: "filter[name][contains]", reason: "must not contain NULL bytes" }],
    });
  });

  /** The cursor is unsigned, so its strings are client input that reaches the `WHERE` clause. */
  test("rejects a NULL byte in a cursor's id as an invalid cursor", () => {
    const cursor = encodeSurveyListPageCursor({
      version: 1,
      sortBy: "name",
      value: "Alpha",
      id: "survey\u0000",
    });
    const r = parseV3SurveysListQuery(params(`workspaceId=${wid}&sortBy=name&cursor=${cursor}`));
    expect(r).toEqual({ ok: false, invalid_params: [{ name: "cursor", reason: "The cursor is invalid." }] });
  });
});

describe("visibility and owner filters (ENG-3282)", () => {
  const workspaceId = "clxx1234567890123456789012";

  test("parses repeated and comma-separated values into the visibility filter", () => {
    const result = parseV3SurveysListQuery(
      new URLSearchParams(
        `workspaceId=${workspaceId}&filter[visibility][in]=restricted&filter[owner][in]=me,others`
      )
    );

    expect(result).toMatchObject({
      ok: true,
      visibilityFilter: { owner: ["me", "others"], visibility: ["restricted"] },
    });
  });

  test("rejects a value outside either enum", () => {
    expect(
      parseV3SurveysListQuery(new URLSearchParams(`workspaceId=${workspaceId}&filter[visibility][in]=secret`))
        .ok
    ).toBe(false);
    expect(
      parseV3SurveysListQuery(new URLSearchParams(`workspaceId=${workspaceId}&filter[owner][in]=you`)).ok
    ).toBe(false);
  });

  test("carries no visibility filter when none is given", () => {
    expect(parseV3SurveysListQuery(new URLSearchParams(`workspaceId=${workspaceId}`))).toMatchObject({
      visibilityFilter: {},
    });
  });
});
