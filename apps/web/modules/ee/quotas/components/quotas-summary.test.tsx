import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveySummary } from "@formbricks/types/surveys/types";
import { QuotasSummary } from "./quotas-summary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress, barColor, height }: { progress: number; barColor: string; height: number }) => (
    <div data-testid="progress-bar" data-progress={progress} data-bar-color={barColor} data-height={height} />
  ),
}));

describe("QuotasSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuotas: TSurveySummary["quotas"] = [
    {
      id: "quota1",
      name: "Demographics Quota",
      limit: 100,
      count: 75,
      percentage: 75,
    },
    {
      id: "quota2",
      name: "Age Group Quota",
      limit: 50,
      count: 25,
      percentage: 50,
    },
  ];

  test("renders quotas table header correctly", () => {
    render(<QuotasSummary quotas={mockQuotas} />);

    expect(screen.getByText("common.progress")).toBeInTheDocument();
    expect(screen.getByText("common.label")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.limit")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.current_count")).toBeInTheDocument();
  });

  test("renders quotas data correctly", () => {
    render(<QuotasSummary quotas={mockQuotas} />);

    expect(screen.getByText("Demographics Quota")).toBeInTheDocument();
    expect(screen.getByText("Age Group Quota")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  test("renders progress bars with correct props", () => {
    render(<QuotasSummary quotas={mockQuotas} />);

    const progressBars = screen.getAllByTestId("progress-bar");
    expect(progressBars).toHaveLength(2);

    expect(progressBars[0]).toHaveAttribute("data-progress", "0.75");
    expect(progressBars[0]).toHaveAttribute("data-bar-color", "bg-brand-dark");
    expect(progressBars[0]).toHaveAttribute("data-height", "2");

    expect(progressBars[1]).toHaveAttribute("data-progress", "0.5");
    expect(progressBars[1]).toHaveAttribute("data-bar-color", "bg-brand-dark");
    expect(progressBars[1]).toHaveAttribute("data-height", "2");
  });

  test("renders no quotas message when quotas array is empty", () => {
    render(<QuotasSummary quotas={[]} />);

    expect(screen.getByText("common.no_quotas_found")).toBeInTheDocument();
    expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
    expect(screen.queryByText("Demographics Quota")).not.toBeInTheDocument();
  });

  test("renders single quota correctly", () => {
    const singleQuota: TSurveySummary["quotas"] = [
      {
        id: "quota1",
        name: "Single Quota",
        limit: 200,
        count: 150,
        percentage: 75,
      },
    ];

    render(<QuotasSummary quotas={singleQuota} />);

    expect(screen.getByText("Single Quota")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("data-progress", "0.75");
  });

  test("handles zero percentage correctly", () => {
    const zeroPercentageQuota: TSurveySummary["quotas"] = [
      {
        id: "quota1",
        name: "Zero Quota",
        limit: 100,
        count: 0,
        percentage: 0,
      },
    ];

    render(<QuotasSummary quotas={zeroPercentageQuota} />);

    expect(screen.getByText("Zero Quota")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("data-progress", "0");
  });

  test("handles 100 percentage correctly", () => {
    const fullPercentageQuota: TSurveySummary["quotas"] = [
      {
        id: "quota1",
        name: "Full Quota",
        limit: 50,
        count: 50,
        percentage: 100,
      },
    ];

    render(<QuotasSummary quotas={fullPercentageQuota} />);

    expect(screen.getByText("Full Quota")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("data-progress", "1");
  });
});
