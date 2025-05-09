import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressBar } from "./progress-bar";

// Mock Progress component to capture progress prop
vi.mock("@/components/general/progress", () => ({
  Progress: ({ progress }: { progress: number }) => <div data-testid="progress">{progress}</div>,
}));

// Stub calculateElementIdx to return index
vi.mock("@/lib/utils", () => ({
  calculateElementIdx: (_survey: any, idx: number, _total: number) => idx,
}));

// Unmount and cleanup DOM between tests
afterEach(() => cleanup());

describe("ProgressBar", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseSurvey: any = {
    questions: [{ id: "q1" }, { id: "q2" }],
    endings: [{ id: "end1" }],
  };

  it("renders 0 for start", () => {
    render(<ProgressBar survey={baseSurvey} questionId="start" />);
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
  });

  it("renders correct progress for questions", () => {
    // totalCards = questions.length + 1 = 3
    render(<ProgressBar survey={baseSurvey} questionId="q1" />);
    expect(screen.getByTestId("progress")).toHaveTextContent("0");

    // Clean up before next render
    cleanup();

    render(<ProgressBar survey={baseSurvey} questionId="q2" />);
    expect(screen.getByTestId("progress")).toHaveTextContent((1 / 3).toString());
  });

  it("renders 1 for ending card", () => {
    render(<ProgressBar survey={baseSurvey} questionId="end1" />);
    expect(screen.getByTestId("progress")).toHaveTextContent("1");
  });
});
