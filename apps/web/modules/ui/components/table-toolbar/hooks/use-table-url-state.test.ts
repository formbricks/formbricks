/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TFilterProperty } from "../lib/types";
import { useTableUrlState } from "./use-table-url-state";

const navigation = vi.hoisted(() => ({ query: "", pathname: "/surveys" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  usePathname: () => navigation.pathname,
}));

const properties: TFilterProperty[] = [
  {
    id: "status",
    label: "Status",
    valueType: "enum",
    quick: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Live", value: "live" },
    ],
  },
  { id: "name", label: "Name", valueType: "string", ruleOperators: ["contains"] },
];

const sortOptions = ["updatedAt", "createdAt", "name"];

/** Sets both the URL Next.js reports and the live browser URL the hook writes from. */
const setUrl = (query: string) => {
  navigation.query = query;
  globalThis.window.history.replaceState(null, "", query ? `/surveys?${query}` : "/surveys");
};

const render = () =>
  renderHook(() => useTableUrlState({ properties, sortOptions, defaultSortBy: "updatedAt" }));

const liveParams = () => new URLSearchParams(globalThis.window.location.search);

describe("useTableUrlState", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setUrl("");
    replaceState = vi.spyOn(globalThis.window.history, "replaceState");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reads filters, search and sort from the URL", () => {
    setUrl(
      "filter%5Bstatus%5D%5Bin%5D=draft&filter%5Bstatus%5D%5Bin%5D=live&filter%5Bname%5D%5Bcontains%5D=nps&search=hello&sortBy=name"
    );

    const { result } = render();

    expect(result.current.filters).toEqual([
      { property: "status", operator: "in", values: ["draft", "live"] },
      { property: "name", operator: "contains", values: ["nps"] },
    ]);
    expect(result.current.search).toBe("hello");
    expect(result.current.sortBy).toBe("name");
  });

  test("falls back to the default sort for a missing or unknown sort", () => {
    const { result, rerender } = render();
    expect(result.current.sortBy).toBe("updatedAt");
    expect(result.current.search).toBe("");
    expect(result.current.filters).toEqual([]);

    setUrl("sortBy=dropTable");
    rerender();
    expect(result.current.sortBy).toBe("updatedAt");
  });

  test("writes search via replaceState and keeps unrelated params", () => {
    setUrl("tab=all&sortBy=name");
    const { result } = render();
    replaceState.mockClear();

    act(() => result.current.setSearch("  feedback  "));

    expect(replaceState).toHaveBeenCalledTimes(1);
    const params = liveParams();
    expect(globalThis.window.location.pathname).toBe("/surveys");
    expect(params.get("tab")).toBe("all");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("search")).toBe("feedback");
  });

  test("writes start from the live URL so two writes in one tick both land", () => {
    const { result } = render();

    act(() => {
      result.current.setSearch("nps");
      result.current.setFilters([{ property: "status", operator: "in", values: ["live"] }]);
    });

    const params = liveParams();
    expect(params.get("search")).toBe("nps");
    expect(params.getAll("filter[status][in]")).toEqual(["live"]);
  });

  test("omits the default sort and writes any other offered sort", () => {
    setUrl("sortBy=name");
    const { result } = render();

    act(() => result.current.setSortBy("createdAt"));
    expect(liveParams().get("sortBy")).toBe("createdAt");

    act(() => result.current.setSortBy("updatedAt"));
    expect(liveParams().has("sortBy")).toBe(false);
    expect(globalThis.window.location.search).toBe("");
  });

  test("drops a sort the table does not offer when writing", () => {
    setUrl("sortBy=dropTable");
    const { result } = render();

    act(() => result.current.setSearch("nps"));

    const params = liveParams();
    expect(params.has("sortBy")).toBe(false);
    expect(params.get("search")).toBe("nps");
  });

  test("clearFilters removes filters and search but keeps sort and other params", () => {
    setUrl("tab=all&filter%5Bstatus%5D%5Bin%5D=draft&search=hello&sortBy=name");
    const { result } = render();

    act(() => result.current.clearFilters());

    const params = liveParams();
    expect(params.get("tab")).toBe("all");
    expect(params.get("sortBy")).toBe("name");
    expect(params.has("search")).toBe(false);
    expect(params.has("filter[status][in]")).toBe(false);
  });

  test("writes the bare pathname when nothing is left in the query", () => {
    setUrl("search=hello");
    const { result } = render();
    replaceState.mockClear();

    act(() => result.current.clearFilters());

    expect(replaceState).toHaveBeenCalledWith(null, "", "/surveys");
  });
});
