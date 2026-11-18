/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { useChartDirtyState } from "./use-chart-dirty-state";

vi.mock("@/modules/ui/hooks/use-before-unload-prompt", () => ({
  useBeforeUnloadPrompt: vi.fn(),
}));

const savedChart = {
  chartType: "bar",
  query: { measures: ["FeedbackRecords.count"] },
  data: [],
} as unknown as AnalyticsResponse;

const render = (props: Partial<Parameters<typeof useChartDirtyState>[0]> = {}) =>
  renderHook((overrides: Partial<Parameters<typeof useChartDirtyState>[0]> = {}) =>
    useChartDirtyState({
      open: true,
      isReady: true,
      isSaving: false,
      chartName: "NPS by source",
      chartData: savedChart,
      chartConfig: {},
      hasUnadoptedQueryEdit: false,
      ...props,
      ...overrides,
    })
  );

describe("useChartDirtyState", () => {
  test("a saved chart that nobody touched is not unsaved work", () => {
    // The bug this replaced: "has chart data" is true the moment a saved chart loads, so opening one
    // and closing it claimed pending changes every time.
    const { result } = render();

    expect(result.current.hasUnsavedChart).toBe(false);
  });

  test("changing the name after the dialog settles counts as unsaved work", () => {
    const { result, rerender } = render();
    expect(result.current.hasUnsavedChart).toBe(false);

    rerender({ chartName: "Something else" });

    expect(result.current.hasUnsavedChart).toBe(true);
  });

  test("configuring a new chart counts, because it starts from an empty snapshot", () => {
    const { result, rerender } = render({ chartData: null, chartName: "" });
    expect(result.current.hasUnsavedChart).toBe(false);

    rerender({ chartData: savedChart, chartName: "" });

    expect(result.current.hasUnsavedChart).toBe(true);
  });

  test("saving is not unsaved work — the guard must not fire on the way out", () => {
    const { result, rerender } = render();
    rerender({ chartName: "Something else" });
    expect(result.current.hasUnsavedChart).toBe(true);

    rerender({ chartName: "Something else", isSaving: true });

    expect(result.current.hasUnsavedChart).toBe(false);
  });

  test("an untouched chart is discarded without asking; a changed one asks first", () => {
    const { result, rerender } = render();

    const straightThrough = vi.fn();
    act(() => result.current.confirmDiscard(straightThrough));
    expect(straightThrough).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirmingDiscard).toBe(false);

    rerender({ chartName: "Something else" });
    const deferred = vi.fn();
    act(() => result.current.confirmDiscard(deferred));

    expect(deferred).not.toHaveBeenCalled();
    expect(result.current.isConfirmingDiscard).toBe(true);

    act(() => result.current.runPendingDiscard());

    expect(deferred).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirmingDiscard).toBe(false);
  });

  test("a query edit the preview never adopted still asks before discarding", () => {
    // ENG-7056: a 6th filter is rejected by the query, so chartData keeps the saved query and the
    // snapshot alone saw nothing to lose.
    const { result, rerender } = render();
    expect(result.current.hasUnsavedChart).toBe(false);

    rerender({ hasUnadoptedQueryEdit: true });
    expect(result.current.hasUnsavedChart).toBe(true);

    const close = vi.fn();
    act(() => result.current.confirmDiscard(close));

    expect(close).not.toHaveBeenCalled();
    expect(result.current.isConfirmingDiscard).toBe(true);
  });

  test("a query edit asks even before a baseline exists, e.g. when the saved chart's data failed to load", () => {
    const { result } = render({ isReady: false, chartData: null, hasUnadoptedQueryEdit: true });

    expect(result.current.hasUnsavedChart).toBe(true);
  });
});
