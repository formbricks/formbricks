import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WebAppTab } from "./WebAppTab";

vi.mock("@/modules/ui/components/button/Button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  CopyIcon: () => <div data-testid="copy-icon" />,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

// Mock navigator.clipboard.writeText
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
});

const surveyUrl = "https://app.formbricks.com/s/test-survey-id";
const surveyId = "test-survey-id";

describe("WebAppTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with surveyUrl and surveyId", () => {
    render(<WebAppTab />);

    expect(screen.getByText("environments.surveys.summary.quickstart_web_apps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.learn_more" })).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/quickstart"
    );
  });
});
