import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EnableInsightsBanner } from "./EnableInsightsBanner";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
  },
}));

vi.mock("@/modules/ee/insights/actions", () => ({
  generateInsightsForSurveyAction: vi.fn(),
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className: string }) => (
    <div data-testid="alert" className={className}>
      {children}
    </div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
  AlertDescription: ({ children, className }: { children: React.ReactNode; className: string }) => (
    <div data-testid="alert-description" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ type, size, text }: { type: string; size: string; text: string }) => (
    <span data-testid="badge" data-type={type} data-size={size}>
      {text}
    </span>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({
    size,
    className,
    onClick,
    loading,
    disabled,
    children,
  }: {
    size: string;
    className: string;
    onClick: () => void;
    loading: boolean;
    disabled: boolean;
    children: React.ReactNode;
  }) => (
    <button
      data-testid="button"
      data-size={size}
      className={className}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({
    tooltipContent,
    children,
  }: {
    tooltipContent: string | undefined;
    children: React.ReactNode;
  }) => (
    <div data-testid="tooltip" data-content={tooltipContent}>
      {children}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  SparklesIcon: ({ className, strokeWidth }: { className: string; strokeWidth: number }) => (
    <div data-testid="sparkles-icon" className={className} data-stroke-width={strokeWidth} />
  ),
}));

describe("EnableInsightsBanner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const surveyId = "survey-123";

  test("renders banner with correct content", () => {
    render(<EnableInsightsBanner surveyId={surveyId} maxResponseCount={100} surveyResponseCount={50} />);

    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("Beta");
    expect(screen.getByTestId("alert-description")).toBeInTheDocument();
    expect(screen.getByTestId("sparkles-icon")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.enable_ai_insights_banner_button")
    ).toBeInTheDocument();
  });

  test("disables button when response count exceeds maximum", () => {
    render(<EnableInsightsBanner surveyId={surveyId} maxResponseCount={50} surveyResponseCount={100} />);

    const button = screen.getByTestId("button");
    expect(button).toBeDisabled();

    // Tooltip should have content when button is disabled
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute(
      "data-content",
      "environments.surveys.summary.enable_ai_insights_banner_tooltip"
    );
  });

  test("enables button when response count is within maximum", () => {
    render(<EnableInsightsBanner surveyId={surveyId} maxResponseCount={100} surveyResponseCount={50} />);

    const button = screen.getByTestId("button");
    expect(button).not.toBeDisabled();

    // Tooltip should not have content when button is enabled
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).not.toHaveAttribute(
      "data-content",
      "environments.surveys.summary.enable_ai_insights_banner_tooltip"
    );
  });

  test("generates insights when button is clicked", async () => {
    const { generateInsightsForSurveyAction } = await import("@/modules/ee/insights/actions");

    render(<EnableInsightsBanner surveyId={surveyId} maxResponseCount={100} surveyResponseCount={50} />);

    const button = screen.getByTestId("button");
    await userEvent.click(button);

    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(generateInsightsForSurveyAction).toHaveBeenCalledWith({ surveyId });

    // Banner should disappear after generating insights
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
  });
});
