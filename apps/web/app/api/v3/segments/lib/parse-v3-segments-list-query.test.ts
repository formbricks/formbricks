import { describe, expect, test, vi } from "vitest";
import { encodeSortCursor } from "@/app/api/v3/lib/sort-cursor";
import {
  SEGMENTS_CURSOR_KIND,
  computeV3SegmentsFingerprint,
  parseV3SegmentsListQuery,
} from "./parse-v3-segments-list-query";

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const workspaceId = "clws0000000000000000000001";
const params = (entries: [string, string][] = []) =>
  new URLSearchParams([["workspaceId", workspaceId], ...entries]);

const cursorFor = (sortBy: string, value: string, search?: string) =>
  encodeSortCursor({
    kind: SEGMENTS_CURSOR_KIND,
    sortBy,
    fp: computeV3SegmentsFingerprint(workspaceId, search),
    value,
    id: "clsg0000000000000000000001",
  });

describe("parseV3SegmentsListQuery", () => {
  test("applies the defaults", () => {
    expect(parseV3SegmentsListQuery(params())).toMatchObject({
      ok: true,
      workspaceId,
      limit: 50,
      cursor: null,
      includeTotalCount: false,
      search: undefined,
      sortBy: "-updatedAt",
    });
  });

  test.each(["title", "-updatedAt", "-createdAt"])("accepts sortBy=%s", (sortBy) => {
    expect(parseV3SegmentsListQuery(params([["sortBy", sortBy]])).ok).toBe(true);
  });

  test.each([
    ["an unknown parameter", [["search", "x"]], "search"],
    ["an unknown sort", [["sortBy", "updatedAt"]], "sortBy"],
    ["a limit above 250", [["limit", "251"]], "limit"],
    ["a non-boolean includeTotalCount", [["includeTotalCount", "yes"]], "includeTotalCount"],
    [
      "a repeated parameter",
      [
        ["filter[title][contains]", "a"],
        ["filter[title][contains]", "b"],
      ],
      "filter[title][contains]",
    ],
  ] as [string, [string, string][], string][])("rejects %s", (_label, entries, name) => {
    const result = parseV3SegmentsListQuery(params(entries));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.invalid_params[0].name).toBe(name);
  });

  test("decodes a cursor issued for the same sort and search", () => {
    const result = parseV3SegmentsListQuery(
      params([
        ["sortBy", "title"],
        ["filter[title][contains]", "vip"],
        ["cursor", cursorFor("title", "VIP users", "vip")],
      ])
    );
    expect(result.ok && result.cursor).toMatchObject({
      value: "VIP users",
      id: "clsg0000000000000000000001",
    });
  });

  test.each([
    [
      "a different sort",
      [
        ["sortBy", "-createdAt"],
        ["cursor", cursorFor("title", "VIP")],
      ],
    ],
    [
      "a different search",
      [
        ["sortBy", "title"],
        ["filter[title][contains]", "other"],
        ["cursor", cursorFor("title", "VIP")],
      ],
    ],
    ["a timestamp sort with a non-date position", [["cursor", cursorFor("-updatedAt", "VIP")]]],
    ["a malformed cursor", [["cursor", "%%%"]]],
  ] as [string, [string, string][]][])("rejects a cursor with %s", (_label, entries) => {
    const result = parseV3SegmentsListQuery(params(entries));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.invalid_params[0].name).toBe("cursor");
  });
});
