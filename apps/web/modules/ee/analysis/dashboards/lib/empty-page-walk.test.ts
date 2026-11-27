import { describe, expect, test } from "vitest";
import { countTrailingEmptyPages, shouldWalkPastEmptyPage } from "./empty-page-walk";

const empty = { data: [] };
const full = { data: [{ id: "d1" }] };
const walk = (pages: { data: unknown[] }[] | undefined, overrides: Partial<{ hasNextPage: boolean }> = {}) =>
  shouldWalkPastEmptyPage({
    pages,
    hasNextPage: true,
    isFetching: false,
    isError: false,
    batchSize: 3,
    ...overrides,
  });

describe("countTrailingEmptyPages", () => {
  test("counts only the empty pages at the end, in a row", () => {
    expect(countTrailingEmptyPages([])).toBe(0);
    expect(countTrailingEmptyPages([full])).toBe(0);
    expect(countTrailingEmptyPages([empty, full, empty, empty])).toBe(2);
  });
});

describe("shouldWalkPastEmptyPage", () => {
  test("walks on after an empty page that has a next cursor", () => {
    expect(walk([empty])).toBe(true);
    expect(walk([full, empty])).toBe(true);
  });

  test("does not walk after a page with rows, or at the end of the list", () => {
    expect(walk([full])).toBe(false);
    expect(walk([empty], { hasNextPage: false })).toBe(false);
    expect(walk(undefined)).toBe(false);
  });

  test("does not walk while a page is in flight or after a failed fetch, so an error never loops", () => {
    expect(
      shouldWalkPastEmptyPage({ pages: [empty], hasNextPage: true, isFetching: true, isError: false })
    ).toBe(false);
    expect(
      shouldWalkPastEmptyPage({ pages: [empty], hasNextPage: true, isFetching: false, isError: true })
    ).toBe(false);
  });

  test("stops after a batch of empty pages, and walks one more batch after each Load more", () => {
    expect(walk([empty, empty])).toBe(true);
    expect(walk([empty, empty, empty])).toBe(false);
    // "Load more" fetched a fourth empty page: the next batch walks on until six.
    expect(walk([empty, empty, empty, empty])).toBe(true);
    expect(walk([empty, empty, empty, empty, empty, empty])).toBe(false);
  });
});
