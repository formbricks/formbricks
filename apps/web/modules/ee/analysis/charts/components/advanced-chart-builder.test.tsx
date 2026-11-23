/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";

const mockRunQuery = vi.fn();

vi.mock("@/modules/ee/analysis/charts/hooks/use-chart-query", () => ({
  useChartQuery: () => ({ isLoading: false, error: null, runQuery: mockRunQuery }),
}));

vi.mock("@/modules/ee/analysis/charts/hooks/use-dataset-chart-fields", () => ({
  useDatasetChartFields: () => ({ status: "ready", embeddedFields: [] }),
}));

// The panels only edit the form; the auto-run under test reads the form, not what the panels render.
vi.mock("@/modules/ee/analysis/charts/components/measures-panel", () => ({ MeasuresPanel: () => null }));
vi.mock("@/modules/ee/analysis/charts/components/dimensions-panel", () => ({ DimensionsPanel: () => null }));
vi.mock("@/modules/ee/analysis/charts/components/filters-panel", () => ({ FiltersPanel: () => null }));
vi.mock("@/modules/ee/analysis/charts/components/time-dimension-panel", () => ({
  TimeDimensionPanel: () => null,
}));
vi.mock("@/modules/ee/analysis/charts/components/matrix-question-picker", () => ({
  MatrixQuestionPicker: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { AdvancedChartBuilder } = await import("./advanced-chart-builder");

const WORKSPACE_ID = "ws-123";
const savedQuery: TChartQuery = { measures: ["FeedbackRecords.count"] };

describe("AdvancedChartBuilder auto-run", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRunQuery.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderBuilder = (feedbackDirectoryId: string | null) =>
    render(
      <AdvancedChartBuilder
        workspaceId={WORKSPACE_ID}
        chartType="bar"
        initialQuery={savedQuery}
        feedbackDirectoryId={feedbackDirectoryId}
      />
    );

  test("does not re-run a saved query that already ran against the same data source", async () => {
    renderBuilder("frd-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockRunQuery).not.toHaveBeenCalled();
  });

  test("re-runs the same query when the data source changes", async () => {
    const { rerender } = renderBuilder("frd-1");

    rerender(
      <AdvancedChartBuilder
        workspaceId={WORKSPACE_ID}
        chartType="bar"
        initialQuery={savedQuery}
        feedbackDirectoryId="frd-2"
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockRunQuery).toHaveBeenCalledTimes(1);
    expect(mockRunQuery).toHaveBeenCalledWith(savedQuery, "bar");
  });
});
