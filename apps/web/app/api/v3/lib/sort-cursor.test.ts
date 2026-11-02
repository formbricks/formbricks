import { describe, expect, test } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  MAX_SORT_CURSOR_VALUE_LENGTH,
  buildSortCursorPage,
  decodeSortCursor,
  encodeSortCursor,
} from "./sort-cursor";

const expected = { kind: "segments", sortBy: "name", fp: "fingerprint00000" };
const token = encodeSortCursor({ ...expected, value: "Beta", id: "clsg0000000000000000000002" });

describe("sort cursor", () => {
  test("round-trips a string sort value", () => {
    expect(decodeSortCursor(token, expected)).toEqual({
      version: 1,
      ...expected,
      value: "Beta",
      id: "clsg0000000000000000000002",
    });
  });

  test.each([
    ["garbage", "%%%%"],
    ["a re-spelled token", `${token}=`],
    ["an oversized token", "a".repeat(4096)],
  ])("rejects %s", (_label, raw) => {
    expect(() => decodeSortCursor(raw, expected)).toThrow(InvalidInputError);
  });

  test("rejects a cursor from another collection, sort or filter set", () => {
    expect(() => decodeSortCursor(token, { ...expected, kind: "contacts" })).toThrow(
      "The cursor is invalid."
    );
    expect(() => decodeSortCursor(token, { ...expected, sortBy: "-updatedAt" })).toThrow(
      "The cursor does not match the requested sort order."
    );
    expect(() => decodeSortCursor(token, { ...expected, fp: "otherfingerprint" })).toThrow(
      "The cursor was issued for a different filter set."
    );
  });

  test("builds the next cursor only when an extra row exists", () => {
    const rows = [
      { id: "a", title: "Alpha" },
      { id: "b", title: "Beta" },
      { id: "c", title: "Gamma" },
    ];
    const sortValue = (row: { title: string }) => row.title;

    const more = buildSortCursorPage({ rows, limit: 2, ...expected, sortValue });
    expect(more.page.map((row) => row.id)).toEqual(["a", "b"]);
    expect(decodeSortCursor(more.nextCursor as string, expected)).toMatchObject({ value: "Beta", id: "b" });

    const last = buildSortCursorPage({ rows, limit: 3, ...expected, sortValue });
    expect(last.page).toHaveLength(3);
    expect(last.nextCursor).toBeNull();
  });

  test("leaves out a sort value too long to carry, and the token still decodes", () => {
    const long = "x".repeat(MAX_SORT_CURSOR_VALUE_LENGTH + 1);
    const rows = [
      { id: "a", title: long },
      { id: "b", title: "Beta" },
    ];

    const { nextCursor } = buildSortCursorPage({
      rows,
      limit: 1,
      ...expected,
      sortValue: (row) => row.title,
    });

    expect(decodeSortCursor(nextCursor as string, expected)).toMatchObject({ value: null, id: "a" });
  });
});
