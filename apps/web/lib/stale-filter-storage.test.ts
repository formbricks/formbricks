import { describe, expect, test, vi } from "vitest";
import { STALE_FILTER_STORAGE_KEYS, removeStaleFilterStorage } from "./stale-filter-storage";

describe("removeStaleFilterStorage", () => {
  test("removes the old Surveys and Workflows filter keys", () => {
    const removeItem = vi.fn();
    removeStaleFilterStorage({ removeItem });
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual(STALE_FILTER_STORAGE_KEYS);
    expect(STALE_FILTER_STORAGE_KEYS).toEqual([
      "formbricks-surveys-filters",
      "formbricks-workflows-filters",
      "formbricks-creatives-filters",
    ]);
  });

  test("swallows blocked storage", () => {
    expect(() =>
      removeStaleFilterStorage({
        removeItem: () => {
          throw new Error("SecurityError");
        },
      })
    ).not.toThrow();
    expect(() => removeStaleFilterStorage(undefined)).not.toThrow();
  });
});
