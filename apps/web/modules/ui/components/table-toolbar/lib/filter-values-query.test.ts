import { describe, expect, test, vi } from "vitest";
import { getFilterValuesQuery } from "./filter-values-query";
import type { TFilterProperty } from "./types";

const page = { options: [{ value: "a", label: "A" }], hasMore: false };

describe("getFilterValuesQuery", () => {
  test("keys a property without its own key by its id and the search", () => {
    const property: TFilterProperty = { id: "tag", label: "Tag", valueType: "enum" };
    expect(getFilterValuesQuery(property, "ne").queryKey).toEqual(["table-filter-values", "tag", "ne"]);
  });

  test("uses the property's own key, so its owner can invalidate the list", () => {
    const property: TFilterProperty = {
      id: "f",
      label: "F",
      valueType: "enum",
      queryKey: (search) => ["mine", search],
    };
    expect(getFilterValuesQuery(property, "x").queryKey).toEqual(["mine", "x"]);
  });

  test("hands the query's abort signal to the loader, so a superseded search is cancelled", async () => {
    const loadOptions = vi.fn(async () => page);
    const property: TFilterProperty = { id: "f", label: "F", valueType: "enum", loadOptions };
    const controller = new AbortController();

    await expect(getFilterValuesQuery(property, "x").queryFn({ signal: controller.signal })).resolves.toBe(
      page
    );
    expect(loadOptions).toHaveBeenCalledWith("x", controller.signal);
  });

  test("a property without a loader answers an empty page", async () => {
    const property: TFilterProperty = { id: "f", label: "F", valueType: "enum" };
    await expect(
      getFilterValuesQuery(property, "").queryFn({ signal: new AbortController().signal })
    ).resolves.toEqual({ options: [], hasMore: false });
  });
});
