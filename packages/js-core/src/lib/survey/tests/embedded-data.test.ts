import { beforeEach, describe, expect, test, vi } from "vitest";
import { EmbeddedDataStore } from "@/lib/survey/embedded-data";

describe("EmbeddedDataStore", () => {
  let store: EmbeddedDataStore;

  beforeEach(() => {
    store = EmbeddedDataStore.getInstance();
    store.clearEmbeddedData();
  });

  test("merges instead of replacing: setting one key keeps the others", () => {
    store.setEmbeddedData({ plan: "pro", pageType: "product" });
    store.setEmbeddedData({ pageType: "checkout" });

    expect(store.getSnapshot()).toEqual({ plan: "pro", pageType: "checkout" });
  });

  test("null drops the key", () => {
    store.setEmbeddedData({ plan: "pro", pageType: "product" });
    store.setEmbeddedData({ pageType: null });

    expect(store.getSnapshot()).toEqual({ plan: "pro" });
  });

  // One keystroke away from `null` and the opposite behavior: the GTM pattern passes every field
  // unconditionally, so a key absent on the current page type arrives as `undefined` and must not
  // clear what a previous page set.
  test("undefined is a no-op — does not set, does not drop", () => {
    store.setEmbeddedData({ plan: "pro" });
    store.setEmbeddedData({ plan: undefined, pageType: undefined });

    expect(store.getSnapshot()).toEqual({ plan: "pro" });
  });

  test("clearEmbeddedData(key) removes one key, clearEmbeddedData() removes everything", () => {
    store.setEmbeddedData({ plan: "pro", pageType: "product", seats: 4 });

    store.clearEmbeddedData("pageType");
    expect(store.getSnapshot()).toEqual({ plan: "pro", seats: 4 });

    store.clearEmbeddedData();
    expect(store.getSnapshot()).toEqual({});
  });

  test("last write wins per key", () => {
    store.setEmbeddedData({ plan: "free" });
    store.setEmbeddedData({ plan: "pro" });

    expect(store.getSnapshot()).toEqual({ plan: "pro" });
  });

  test("snapshot is a detached copy: later writes do not reach an earlier snapshot", () => {
    store.setEmbeddedData({ plan: "pro" });
    const snapshot = store.getSnapshot();

    store.setEmbeddedData({ plan: "enterprise", extra: "later" });

    expect(snapshot).toEqual({ plan: "pro" });
  });

  test("a __proto__ key is stored as data, not swallowed by the prototype", () => {
    store.setEmbeddedData({ ["__proto__"]: "value" });

    const snapshot = store.getSnapshot();
    expect(Object.hasOwn(snapshot, "__proto__")).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reading the own property back
    expect((snapshot as any)["__proto__"]).toBe("value");
    expect(Object.keys({})).toEqual([]);
  });

  test("never touches localStorage and makes no network calls", () => {
    // `localStorage` is the vi.fn() stub from vitest.setup.ts; `fetch` does not exist in the node
    // test environment, so stub one in to prove it stays uncalled.
    const setItemMock = localStorage.setItem as unknown as ReturnType<typeof vi.fn>;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    store.setEmbeddedData({ plan: "pro", secret: "value" });
    store.clearEmbeddedData("secret");
    store.getSnapshot();
    store.clearEmbeddedData();

    expect(setItemMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    // Deliberately no unstubAllGlobals: that would also strip the window/document/localStorage stubs
    // vitest.setup.ts installs for the whole file. The fetch stub is inert for the remaining tests.
  });
});
