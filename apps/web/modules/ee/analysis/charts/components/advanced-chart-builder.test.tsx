/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { useChartQuery } from "@/modules/ee/analysis/charts/hooks/use-chart-query";
import { type FilterNode, duplicateFilterNode } from "@/modules/ee/analysis/lib/query-builder";
import { AdvancedChartBuilder, type ChartQueryState } from "./advanced-chart-builder";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/ee/analysis/charts/hooks/use-chart-query", () => ({
  useChartQuery: vi.fn(),
}));

vi.mock("@/modules/ee/analysis/charts/hooks/use-dataset-chart-fields", () => ({
  useDatasetChartFields: () => ({ status: "ready", embeddedFields: [] }),
}));

vi.mock("@/modules/ee/analysis/charts/components/dataset-fields-gate", () => ({
  DatasetFieldsGate: ({ children }: Readonly<{ children: React.ReactNode }>) => <>{children}</>,
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({ children }: Readonly<{ children: React.ReactNode }>) => <div>{children}</div>,
}));

vi.mock("@/modules/ee/analysis/charts/components/measures-panel", () => ({
  MeasuresPanel: () => null,
}));

vi.mock("@/modules/ee/analysis/charts/components/dimensions-panel", () => ({
  DimensionsPanel: () => null,
}));

vi.mock("@/modules/ee/analysis/charts/components/time-dimension-panel", () => ({
  TimeDimensionPanel: () => null,
}));

vi.mock("@/modules/ee/analysis/charts/components/matrix-question-picker", () => ({
  MatrixQuestionPicker: () => null,
}));

vi.mock("@/modules/ee/analysis/charts/components/filters-panel", () => ({
  FiltersPanel: ({
    filters,
    onFiltersChange,
  }: Readonly<{
    filters: FilterNode[];
    onFiltersChange: (filters: FilterNode[]) => void;
  }>) => (
    <button type="button" onClick={() => onFiltersChange(duplicateFilterNode(filters, filters[0].id))}>
      duplicate first filter
    </button>
  ),
}));

const savedQuery: TChartQuery = {
  measures: ["FeedbackRecords.count"],
  filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
};

const runQuery = vi.fn();

const renderBuilder = () => {
  const onQueryStateChange = vi.fn<(state: ChartQueryState) => void>();
  render(
    <AdvancedChartBuilder
      workspaceId="workspace-1"
      chartType="bar"
      initialQuery={savedQuery}
      onQueryStateChange={onQueryStateChange}
      feedbackDirectoryId="directory-1"
    />
  );
  const latestState = () => onQueryStateChange.mock.calls.at(-1)?.[0];
  return { latestState };
};

describe("AdvancedChartBuilder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The query is rejected (e.g. one filter too many): no rows come back, so the preview keeps the
    // saved chart and the parent never sees the edited query.
    runQuery.mockResolvedValue(null);
    vi.mocked(useChartQuery).mockReturnValue({
      chartData: null,
      query: null,
      isLoading: false,
      error: null,
      runQuery,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("an untouched saved chart reports no unadopted edit", () => {
    const { latestState } = renderBuilder();

    expect(latestState()?.hasUnadoptedEdit).toBe(false);
  });

  test("an edit whose query is rejected is still reported as an unadopted edit (ENG-7056)", async () => {
    const { latestState } = renderBuilder();

    fireEvent.click(screen.getByRole("button", { name: "duplicate first filter" }));
    expect(latestState()?.hasUnadoptedEdit).toBe(true);

    // Let the debounced auto-run fire and fail.
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(latestState()?.isPending).toBe(false);
    expect(latestState()?.hasUnadoptedEdit).toBe(true);
  });
});
