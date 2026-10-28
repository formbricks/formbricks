import { describe, expect, test } from "vitest";
import { parseDetail } from "./detail";
import { parseListPage, parseShowResponses, readFailure } from "./parse";

const textAnswer = {
  position: 1,
  elementId: "q1",
  elementLabel: "Why?",
  elementType: "openText",
  valueText: "Because",
};
const item = (id: string) => ({
  id,
  createdAt: "2026-03-01T10:00:00.000Z",
  finished: true,
  language: "en",
  tags: [],
  answers: [textAnswer],
});

describe("readFailure", () => {
  test("reads the structured error a Formbricks tool returns", () => {
    expect(
      readFailure({
        isError: true,
        structuredContent: {
          error: { status: 403, title: "Forbidden", detail: "No access to this survey." },
        },
      })
    ).toBe("No access to this survey.");
  });

  test("falls back to the title, then to the text a host hands back", () => {
    expect(readFailure({ isError: true, structuredContent: { error: { title: "Forbidden" } } })).toBe(
      "Forbidden"
    );
    expect(readFailure({ isError: true, content: [{ type: "text", text: "Boom" }] })).toBe("Boom");
    expect(readFailure({ isError: true })).toBe("The request failed.");
  });

  test("reports nothing for a success", () => {
    expect(readFailure({ structuredContent: { data: [] } })).toBeUndefined();
    expect(readFailure(null)).toBeUndefined();
  });
});

describe("parseShowResponses", () => {
  // What the host hands the view: ids and counts in `structuredContent`, the table in `_meta.formbricks`.
  const structured = {
    survey: { id: "sv1" },
    query: { workspaceId: "ws1", surveyId: "sv1", limit: 20, sortBy: "-createdAt", finished: true },
    rowCount: 1,
    columnCount: 1,
    nextCursor: "abc",
    total: { count: 41, relation: "eq" },
  };
  const viewMeta = {
    survey: { name: "Customer survey" },
    columns: [{ id: "q1", label: "Why?", type: "openText", position: 1 }, { nope: true }],
    rows: [
      {
        id: "r1",
        createdAt: "2026-03-01T10:00:00.000Z",
        finished: true,
        language: null,
        tags: ["vip", 3],
        cells: { q1: "Because", q2: 5 },
      },
      { id: "broken" },
    ],
  };
  const result = { structuredContent: structured, _meta: { formbricks: viewMeta } };

  test("reads the query from structuredContent and the table from _meta, dropping entries that do not fit", () => {
    const parsed = parseShowResponses(result);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.survey).toEqual({ id: "sv1", name: "Customer survey" });
    expect(parsed.value.query.finished).toBe(true);
    expect(parsed.value.columns).toHaveLength(1);
    expect(parsed.value.rows).toEqual([
      {
        id: "r1",
        createdAt: "2026-03-01T10:00:00.000Z",
        finished: true,
        language: null,
        tags: ["vip"],
        cells: { q1: "Because" },
      },
    ]);
    expect(parsed.value.nextCursor).toBe("abc");
    expect(parsed.value.total).toEqual({ count: 41, relation: "eq" });
  });

  test("does not read rows, labels or a survey name out of structuredContent", () => {
    const parsed = parseShowResponses({
      structuredContent: { ...structured, rows: viewMeta.rows, columns: viewMeta.columns },
      _meta: { formbricks: { survey: {}, columns: [], rows: [] } },
    });
    expect(parsed.ok && parsed.value.rows).toEqual([]);
    expect(parsed.ok && parsed.value.columns).toEqual([]);
    expect(parsed.ok && parsed.value.survey.name).toBe("Responses");
  });

  test("clamps a hostile limit and tolerates a missing total and cursor", () => {
    const parsed = parseShowResponses({
      ...result,
      structuredContent: {
        ...structured,
        query: { ...structured.query, limit: 100000 },
        nextCursor: null,
        total: undefined,
      },
    });
    expect(parsed.ok && parsed.value.query.limit).toBe(50);
    expect(parsed.ok && parsed.value.nextCursor).toBeNull();
    expect(parsed.ok && parsed.value.total).toBeUndefined();
  });

  test("explains a failed or unreadable result instead of throwing", () => {
    expect(parseShowResponses({ isError: true, structuredContent: { error: { detail: "Nope" } } })).toEqual({
      ok: false,
      message: "Nope",
    });
    expect(parseShowResponses({ structuredContent: { survey: { id: "sv1" } } }).ok).toBe(false);
    // A host that drops `_meta` leaves the view nothing to draw.
    expect(parseShowResponses({ structuredContent: structured }).ok).toBe(false);
    expect(parseShowResponses({ structuredContent: structured, _meta: { formbricks: "x" } }).ok).toBe(false);
    expect(parseShowResponses(null).ok).toBe(false);
  });
});

describe("parseListPage", () => {
  test("reduces a list_responses result to rows, columns, cursor and total", () => {
    const parsed = parseListPage({
      structuredContent: {
        data: [item("r1"), { garbage: true }, item("r2")],
        meta: { limit: 20, nextCursor: "next", totalCount: 1500, totalCountRelation: "gte" },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.rows.map((row) => row.id)).toEqual(["r1", "r2"]);
    expect(parsed.value.columns.map((column) => column.id)).toEqual(["q1"]);
    expect(parsed.value.nextCursor).toBe("next");
    expect(parsed.value.total).toEqual({ count: 1500, relation: "gte" });
  });

  test("treats a null cursor and null total as the end of a list", () => {
    const parsed = parseListPage({
      structuredContent: { data: [], meta: { nextCursor: null, totalCount: null, totalCountRelation: null } },
    });
    expect(parsed.ok && parsed.value.nextCursor).toBeNull();
    expect(parsed.ok && parsed.value.total).toBeUndefined();
  });

  test("surfaces the tool's own error", () => {
    expect(
      parseListPage({ isError: true, structuredContent: { error: { detail: "Cursor is invalid." } } })
    ).toEqual({ ok: false, message: "Cursor is invalid." });
    expect(parseListPage({ structuredContent: {} }).ok).toBe(false);
  });
});

describe("parseDetail", () => {
  const resource = {
    id: "r1",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:05:00.000Z",
    finished: false,
    language: "de",
    durationSeconds: 75,
    contact: { id: "c1", userId: "user-9" },
    tags: [{ id: "t1", name: "vip" }],
    answers: [
      textAnswer,
      {
        elementId: "q2",
        elementType: "nps",
        elementLabel: "NPS",
        valueNumber: 9,
        range: { min: 0, max: 10 },
      },
    ],
    embeddedData: [
      { key: "plan", label: "Plan", value: "pro" },
      { key: "bad", label: "Bad", value: { x: 1 } },
    ],
  };

  test("reads the full answer set, contact and hidden fields", () => {
    const parsed = parseDetail({ structuredContent: { data: resource } });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.answers.map((answer) => answer.lines)).toEqual([["Because"], ["9"]]);
    expect(parsed.value.contact).toEqual({ id: "c1", userId: "user-9" });
    expect(parsed.value.tags).toEqual(["vip"]);
    expect(parsed.value.embedded).toEqual([{ label: "Plan", value: "pro" }]);
    expect(parsed.value.durationSeconds).toBe(75);
  });

  test("caps a very long answer rather than rendering all of it", () => {
    const parsed = parseDetail({
      structuredContent: {
        data: { ...resource, answers: [{ ...textAnswer, valueText: "y".repeat(50000) }] },
      },
    });
    expect(parsed.ok && parsed.value.answers[0]?.lines[0]?.length).toBeLessThan(5000);
  });

  test("explains a failure and an unreadable body", () => {
    expect(parseDetail({ isError: true, structuredContent: { error: { detail: "Forbidden" } } })).toEqual({
      ok: false,
      message: "Forbidden",
    });
    expect(parseDetail({ structuredContent: { data: { id: "r1" } } }).ok).toBe(false);
  });
});
