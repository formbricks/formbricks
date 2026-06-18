import { describe, expect, test } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { paginateByIdCursor } from "./cursor-pagination";

const item = (id: string) => ({ id });

describe("paginateByIdCursor", () => {
  test("returns an empty page with no cursor for an empty collection", () => {
    expect(paginateByIdCursor([], { limit: 10 })).toEqual({ page: [], nextCursor: null });
  });

  test("returns everything with nextCursor=null when the collection fits in one page", () => {
    const result = paginateByIdCursor([item("a"), item("b")], { limit: 5 });
    expect(result.page.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.nextCursor).toBeNull();
  });

  test("returns nextCursor=null when the collection is exactly the page size", () => {
    const result = paginateByIdCursor([item("a"), item("b")], { limit: 2 });
    expect(result.page).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  test("orders by id and walks pages via the opaque cursor", () => {
    const items = [item("c"), item("a"), item("b")]; // intentionally unordered
    const page1 = paginateByIdCursor(items, { limit: 2 });
    expect(page1.page.map((i) => i.id)).toEqual(["a", "b"]);
    expect(typeof page1.nextCursor).toBe("string");

    const page2 = paginateByIdCursor(items, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.page.map((i) => i.id)).toEqual(["c"]);
    expect(page2.nextCursor).toBeNull();
  });

  test("is robust to a stale cursor (the cursor row was deleted between pages)", () => {
    const all = [item("a"), item("b"), item("c")];
    const page1 = paginateByIdCursor(all, { limit: 1 }); // -> ["a"], cursor for "a"
    // "a" is deleted before the next request; paging by id > cursor still returns b, c
    const page2 = paginateByIdCursor([item("b"), item("c")], { limit: 5, cursor: page1.nextCursor! });
    expect(page2.page.map((i) => i.id)).toEqual(["b", "c"]);
    expect(page2.nextCursor).toBeNull();
  });

  test("rejects a malformed (non-canonical) cursor", () => {
    expect(() => paginateByIdCursor([item("a")], { limit: 5, cursor: "%%%%" })).toThrow(InvalidInputError);
    expect(() => paginateByIdCursor([item("a")], { limit: 5, cursor: "not base64url!" })).toThrow(
      InvalidInputError
    );
  });
});
