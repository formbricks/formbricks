import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyStatusIndicator } from "./index";

// Mock the tooltip component
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

// Mock the lucide-react icons
vi.mock("lucide-react", () => ({
  CheckIcon: () => <div data-testid="check-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  PauseIcon: () => <div data-testid="pause-icon" />,
  PencilIcon: () => <div data-testid="pencil-icon" />,
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.gathering_responses": "Gathering responses",
        "common.survey_scheduled": "Survey scheduled",
        "common.survey_paused": "Survey paused",
        "common.survey_completed": "Survey completed",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SurveyStatusIndicator", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders inProgress status correctly without tooltip", () => {
    const { container } = render(<SurveyStatusIndicator status="inProgress" />);

    // Find the green dot using container query instead of getByText
    const greenDotContainer = container.querySelector(".relative.flex.h-3.w-3");
    expect(greenDotContainer).toBeInTheDocument();

    // Check the children elements
    const pingElement = greenDotContainer?.querySelector(".animate-ping-slow");
    const dotElement = greenDotContainer?.querySelector(".relative.inline-flex");

    expect(pingElement).toHaveClass("bg-green-500");
    expect(dotElement).toHaveClass("bg-green-500");

    // Should not render tooltip components
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders scheduled status correctly without tooltip", () => {
    const { container } = render(<SurveyStatusIndicator status="scheduled" />);

    // Find the clock icon container
    const clockIconContainer = container.querySelector(".rounded-full.bg-slate-300.p-1");
    expect(clockIconContainer).toBeInTheDocument();

    // Find the clock icon inside
    const clockIcon = clockIconContainer?.querySelector("[data-testid='clock-icon']");
    expect(clockIcon).toBeInTheDocument();

    // Should not render tooltip components
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders paused status correctly without tooltip", () => {
    const { container } = render(<SurveyStatusIndicator status="paused" />);

    // Find the pause icon container
    const pauseIconContainer = container.querySelector(".rounded-full.bg-slate-300.p-1");
    expect(pauseIconContainer).toBeInTheDocument();

    // Find the pause icon inside
    const pauseIcon = pauseIconContainer?.querySelector("[data-testid='pause-icon']");
    expect(pauseIcon).toBeInTheDocument();

    // Should not render tooltip components
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders completed status correctly without tooltip", () => {
    const { container } = render(<SurveyStatusIndicator status="completed" />);

    // Find the check icon container
    const checkIconContainer = container.querySelector(".rounded-full.bg-slate-200.p-1");
    expect(checkIconContainer).toBeInTheDocument();

    // Find the check icon inside
    const checkIcon = checkIconContainer?.querySelector("[data-testid='check-icon']");
    expect(checkIcon).toBeInTheDocument();

    // Should not render tooltip components
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders draft status correctly without tooltip", () => {
    const { container } = render(<SurveyStatusIndicator status="draft" />);

    // Find the pencil icon container
    const pencilIconContainer = container.querySelector(".rounded-full.bg-slate-300.p-1");
    expect(pencilIconContainer).toBeInTheDocument();

    // Find the pencil icon inside
    const pencilIcon = pencilIconContainer?.querySelector("[data-testid='pencil-icon']");
    expect(pencilIcon).toBeInTheDocument();

    // Should not render tooltip components
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders with tooltip when tooltip prop is true", () => {
    render(<SurveyStatusIndicator status="inProgress" tooltip={true} />);

    // Should render tooltip components
    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();

    // Should have the right content in the tooltip
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toHaveTextContent("Gathering responses");
  });

  test("renders scheduled status with tooltip correctly", () => {
    const { container } = render(<SurveyStatusIndicator status="scheduled" tooltip={true} />);

    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Survey scheduled");

    // Use container query to find the first clock icon
    const clockIcon = container.querySelector("[data-testid='clock-icon']");
    expect(clockIcon).toBeInTheDocument();
  });

  test("renders paused status with tooltip correctly", () => {
    const { container } = render(<SurveyStatusIndicator status="paused" tooltip={true} />);

    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Survey paused");

    // Use container query to find the first pause icon
    const pauseIcon = container.querySelector("[data-testid='pause-icon']");
    expect(pauseIcon).toBeInTheDocument();
  });

  test("renders completed status with tooltip correctly", () => {
    const { container } = render(<SurveyStatusIndicator status="completed" tooltip={true} />);

    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Survey completed");

    // Use container query to find the first check icon
    const checkIcon = container.querySelector("[data-testid='check-icon']");
    expect(checkIcon).toBeInTheDocument();
  });
});
