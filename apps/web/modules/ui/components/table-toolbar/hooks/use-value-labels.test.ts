/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { describe, expect, test, vi } from "vitest";
import type { TFilterOptionsPage, TFilterProperty } from "../lib/types";
import { useLabelledProperty } from "./use-value-labels";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children
  );

const PAGES: Record<string, TFilterOptionsPage> = {
  "": { options: [{ value: "late", label: "Late" }], hasMore: true },
  ontime: { options: [{ value: "ontime", label: "On time" }], hasMore: false },
};

const optionProperty = (labelledValues = true) => {
  const loadOptions = vi.fn(async (search: string) => PAGES[search] ?? { options: [], hasMore: false });
  const property: TFilterProperty = {
    id: `option-${String(labelledValues)}`,
    label: "Value (Option)",
    valueType: "enum",
    labelledValues,
    loadOptions,
  };
  return { property, loadOptions };
};

describe("useLabelledProperty", () => {
  test("names picked values by their labels: from the first page, then a search for the rest", async () => {
    const { property, loadOptions } = optionProperty();
    const { result } = renderHook(() => useLabelledProperty(property, ["late", "ontime", "gone"]), {
      wrapper,
    });
    await waitFor(() => expect(result.current.valueLabels).toEqual({ late: "Late", ontime: "On time" }));
    expect(loadOptions.mock.calls.map(([search]) => search).sort()).toEqual(["", "gone", "ontime"]);
  });

  test("returns a property whose listed values are their own labels as it is, looking nothing up", () => {
    const { property, loadOptions } = optionProperty(false);
    const { result } = renderHook(() => useLabelledProperty(property, ["late"]), { wrapper });
    expect(result.current).toBe(property);
    expect(loadOptions).not.toHaveBeenCalled();
  });
});
