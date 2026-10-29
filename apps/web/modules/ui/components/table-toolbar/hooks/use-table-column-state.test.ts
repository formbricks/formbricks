/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTableColumnState } from "./use-table-column-state";

const PREFIX = "surveys-table";

const readSaved = (suffix: string) => {
  const raw = globalThis.window.localStorage.getItem(`${PREFIX}-${suffix}`);
  return raw === null ? null : JSON.parse(raw);
};

describe("useTableColumnState", () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("starts from the table's columns, all visible, when nothing is saved", async () => {
    const { result } = renderHook(() =>
      useTableColumnState({ storagePrefix: PREFIX, columnIds: ["name", "status", "createdAt"] })
    );

    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["name", "status", "createdAt"]));
    expect(result.current.columnOrder).toEqual(["name", "status", "createdAt"]);
    expect(result.current.columnVisibility).toEqual({ name: true, status: true, createdAt: true });
    expect(result.current.isExpanded).toBe(false);
  });

  test("applies the default visibility to columns with nothing saved", async () => {
    const { result } = renderHook(() =>
      useTableColumnState({
        storagePrefix: PREFIX,
        columnIds: ["name", "status"],
        defaultVisibility: { status: false },
      })
    );

    await waitFor(() => expect(result.current.columnVisibility).toEqual({ name: true, status: false }));
  });

  test("restores a saved layout and reconciles it with the current columns", async () => {
    globalThis.window.localStorage.setItem(
      `${PREFIX}-columnOrder`,
      JSON.stringify(["status", "gone", "name"])
    );
    globalThis.window.localStorage.setItem(
      `${PREFIX}-columnVisibility`,
      JSON.stringify({ status: false, gone: false })
    );
    globalThis.window.localStorage.setItem(`${PREFIX}-rowExpand`, JSON.stringify(true));

    const { result } = renderHook(() =>
      useTableColumnState({
        storagePrefix: PREFIX,
        columnIds: ["name", "status", "newColumn"],
        defaultVisibility: { newColumn: false },
      })
    );

    await waitFor(() => expect(result.current.isExpanded).toBe(true));
    expect(result.current.columnOrder).toEqual(["status", "name", "newColumn"]);
    expect(result.current.columnVisibility).toEqual({ name: true, status: false, newColumn: false });

    // The reconciled layout is written back, so the removed column no longer lingers in storage.
    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["status", "name", "newColumn"]));
    expect(readSaved("columnVisibility")).toEqual({ name: true, status: false, newColumn: false });
    expect(readSaved("rowExpand")).toBe(true);
  });

  test("ignores corrupt saved values", async () => {
    globalThis.window.localStorage.setItem(`${PREFIX}-columnOrder`, "{not json");
    globalThis.window.localStorage.setItem(`${PREFIX}-rowExpand`, JSON.stringify("yes"));

    const { result } = renderHook(() =>
      useTableColumnState({ storagePrefix: PREFIX, columnIds: ["name", "status"] })
    );

    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["name", "status"]));
    expect(result.current.columnOrder).toEqual(["name", "status"]);
    expect(result.current.isExpanded).toBe(false);
  });

  test("appends a column added after mount", async () => {
    const { result, rerender } = renderHook(
      ({ columnIds }: { columnIds: string[] }) => useTableColumnState({ storagePrefix: PREFIX, columnIds }),
      { initialProps: { columnIds: ["name", "status"] } }
    );
    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["name", "status"]));

    act(() => result.current.moveColumn("status", "name"));
    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["status", "name"]));

    rerender({ columnIds: ["name", "status", "attr_plan"] });

    await waitFor(() => expect(result.current.columnOrder).toEqual(["status", "name", "attr_plan"]));
    expect(result.current.columnVisibility.attr_plan).toBe(true);
  });

  test("persists changes made through the setters", async () => {
    const { result } = renderHook(() =>
      useTableColumnState({ storagePrefix: PREFIX, columnIds: ["name", "status"] })
    );
    await waitFor(() => expect(readSaved("rowExpand")).toBe(false));

    act(() => {
      result.current.setIsExpanded(true);
      result.current.setColumnVisibility({ name: true, status: false });
    });

    await waitFor(() => expect(readSaved("rowExpand")).toBe(true));
    expect(readSaved("columnVisibility")).toEqual({ name: true, status: false });
  });

  test("moveColumn reorders and ignores unknown or identical ids", async () => {
    const { result } = renderHook(() =>
      useTableColumnState({ storagePrefix: PREFIX, columnIds: ["a", "b", "c", "d"] })
    );
    await waitFor(() => expect(readSaved("columnOrder")).toEqual(["a", "b", "c", "d"]));

    act(() => result.current.moveColumn("a", "c"));
    expect(result.current.columnOrder).toEqual(["b", "c", "a", "d"]);

    act(() => result.current.moveColumn("d", "b"));
    expect(result.current.columnOrder).toEqual(["d", "b", "c", "a"]);

    const before = result.current.columnOrder;
    act(() => result.current.moveColumn("missing", "b"));
    expect(result.current.columnOrder).toBe(before);
    act(() => result.current.moveColumn("b", "missing"));
    expect(result.current.columnOrder).toBe(before);
    act(() => result.current.moveColumn("b", "b"));
    expect(result.current.columnOrder).toBe(before);
  });

  test("keeps working when storage throws on read and write", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() =>
      useTableColumnState({ storagePrefix: PREFIX, columnIds: ["name", "status"] })
    );

    await waitFor(() => expect(setItem).toHaveBeenCalled());
    expect(result.current.columnOrder).toEqual(["name", "status"]);
    expect(result.current.columnVisibility).toEqual({ name: true, status: true });

    act(() => result.current.moveColumn("status", "name"));
    expect(result.current.columnOrder).toEqual(["status", "name"]);
  });
});
