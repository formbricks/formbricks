/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { describe, expect, test } from "vitest";
import type { TAvailableValuesResult, TFilterProperty } from "../lib/types";
import { isUnavailableValue, useAvailableValues, useEmptyHint } from "./use-available-values";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children
  );

const property = (result: TAvailableValuesResult): TFilterProperty => ({
  id: "sentiment",
  label: "Sentiment",
  valueType: "enum",
  availableValues: {
    queryKey: ["available", JSON.stringify(result)],
    emptyHint: "turn it on",
    load: async () => result,
  },
});

describe("useAvailableValues", () => {
  test("is null for a property that does not say which values occur", () => {
    const { result } = renderHook(
      () => useAvailableValues({ id: "source", label: "Source", valueType: "enum" }),
      { wrapper }
    );
    expect(result.current).toBeNull();
  });

  test("is the set of values the lookup found", async () => {
    const { result } = renderHook(() => useAvailableValues(property({ values: ["positive"] })), { wrapper });
    await waitFor(() => expect(result.current).toEqual(new Set(["positive"])));
    expect(isUnavailableValue(result.current, "negative", [])).toBe(true);
    expect(isUnavailableValue(result.current, "negative", ["negative"])).toBe(false);
  });
});

describe("useEmptyHint", () => {
  test("is the property's own hint while the lookup gives none", async () => {
    const { result } = renderHook(() => useEmptyHint(property({ values: [] })), { wrapper });
    await waitFor(() => expect(result.current).toBe("turn it on"));
  });

  test("is the lookup's hint when it gives one", async () => {
    const { result } = renderHook(() => useEmptyHint(property({ values: [], emptyHint: "none here" })), {
      wrapper,
    });
    await waitFor(() => expect(result.current).toBe("none here"));
  });
});
