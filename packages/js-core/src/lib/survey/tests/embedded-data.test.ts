import { beforeEach, describe, expect, test, vi } from "vitest";
import { EmbeddedDataStore, buildDisplayHiddenFields } from "@/lib/survey/embedded-data";

// The guards log through Logger; mocked so refused inputs don't spray the test output.
vi.mock("@/lib/common/logger", () => ({
  Logger: { getInstance: vi.fn(() => ({ error: vi.fn(), debug: vi.fn() })) },
}));

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

describe("input guards (never fatal)", () => {
  let store: EmbeddedDataStore;

  beforeEach(() => {
    store = EmbeddedDataStore.getInstance();
    store.clearEmbeddedData();
  });

  test("setEmbeddedData(null) and (undefined) do not throw into host code and set nothing", () => {
    store.setEmbeddedData({ plan: "pro" });

    expect(() => {
      store.setEmbeddedData(null as unknown as Parameters<typeof store.setEmbeddedData>[0]);
      store.setEmbeddedData(undefined as unknown as Parameters<typeof store.setEmbeddedData>[0]);
    }).not.toThrow();

    expect(store.getSnapshot()).toEqual({ plan: "pro" });
  });

  test("a primitive argument is refused instead of spreading into junk keys", () => {
    store.setEmbeddedData("plan" as unknown as Parameters<typeof store.setEmbeddedData>[0]);

    expect(store.getSnapshot()).toEqual({});
  });

  test('an array is refused too — typeof [] is "object", but it would spread into numeric junk keys', () => {
    // The common host mistake: forwarding an array-valued data-layer key like `ecommerce.items`.
    store.setEmbeddedData(["a", "b"] as unknown as Parameters<typeof store.setEmbeddedData>[0]);

    expect(store.getSnapshot()).toEqual({});
  });

  test("clearEmbeddedData(undefined) is a no-op, NOT a full clear — one keystroke from the no-arg overload", () => {
    store.setEmbeddedData({ plan: "pro", pageType: "product" });

    // The GTM shape: `clearEmbeddedData(dataLayer.fieldToClear)` where the key is absent this page.
    store.clearEmbeddedData(undefined as unknown as string);

    expect(store.getSnapshot()).toEqual({ plan: "pro", pageType: "product" });
  });
});

describe("buildDisplayHiddenFields", () => {
  beforeEach(() => {
    EmbeddedDataStore.getInstance().clearEmbeddedData();
  });

  test("explicit per-trigger values beat the bag across casings — declared-name matching is case-insensitive downstream", () => {
    EmbeddedDataStore.getInstance().setEmbeddedData({ Plan: "ambient", pageType: "product" });

    expect(buildDisplayHiddenFields({ plan: "explicit" })).toEqual({
      plan: "explicit",
      pageType: "product",
    });
  });

  test("no explicit values: the bag passes through as-is", () => {
    EmbeddedDataStore.getInstance().setEmbeddedData({ plan: "pro" });

    expect(buildDisplayHiddenFields(undefined)).toEqual({ plan: "pro" });
  });

  test("an explicit key whose value is undefined does NOT evict the ambient value", () => {
    // The GTM shape: track("evt", { hiddenFields: { plan: dataLayer.plan } }) on a page where
    // `plan` is absent. Same promise as setEmbeddedData's undefined no-op — a missing data-layer
    // key must never cost the bag its value.
    EmbeddedDataStore.getInstance().setEmbeddedData({ plan: "ambient-pro" });

    expect(
      buildDisplayHiddenFields({ plan: undefined } as unknown as Parameters<
        typeof buildDisplayHiddenFields
      >[0])
    ).toEqual({ plan: "ambient-pro" });
  });
});
