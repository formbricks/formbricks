import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyClosedMessage } from "@formbricks/types/surveys/types";
import { SurveyInactive } from "./survey-inactive";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="mock-image" />
  ),
}));

let linkCounter = 0;

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => {
    const componentId = linkCounter++;
    return (
      <a href={href} data-testid={componentId === 0 ? "create-own-link" : "footer-link"}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("lucide-react", () => ({
  PauseCircleIcon: ({ className }: { className: string }) => (
    <div className={className} data-testid="pause-icon" />
  ),
  CheckCircle2Icon: ({ className }: { className: string }) => (
    <div className={className} data-testid="check-icon" />
  ),
  HelpCircleIcon: ({ className }: { className: string }) => (
    <div className={className} data-testid="help-icon" />
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ className, children }: { className: string; asChild: boolean; children: React.ReactNode }) => (
    <button className={className} data-testid="button">
      {children}
    </button>
  ),
}));

describe("SurveyInactive", () => {
  afterEach(() => {
    cleanup();
    linkCounter = 0; // Reset counter between tests
  });

  test("renders paused status correctly", async () => {
    const Component = await SurveyInactive({ status: "paused" });
    render(Component);

    expect(screen.getByTestId("pause-icon")).toBeInTheDocument();
    expect(screen.getByText("common.survey paused.")).toBeInTheDocument();
    expect(screen.getByText("s.paused")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();

    // Use within to search for links in specific contexts
    expect(screen.getByTestId("create-own-link")).toHaveAttribute("href", "https://formbricks.com");
    expect(screen.getByTestId("footer-link")).toHaveAttribute("href", "https://formbricks.com");
  });

  test("renders completed status without surveyClosedMessage correctly", async () => {
    const Component = await SurveyInactive({ status: "completed" });
    render(Component);

    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.getByText("common.survey completed.")).toBeInTheDocument();
    expect(screen.getByText("s.completed")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
  });

  test("renders completed status with surveyClosedMessage correctly", async () => {
    const surveyClosedMessage: TSurveyClosedMessage = {
      heading: "Custom Heading",
      subheading: "Custom Subheading",
    };

    const Component = await SurveyInactive({ status: "completed", surveyClosedMessage });
    render(Component);

    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.getByText("Custom Heading")).toBeInTheDocument();
    expect(screen.getByText("Custom Subheading")).toBeInTheDocument();
    expect(screen.queryByTestId("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
  });

  test("renders link invalid status correctly", async () => {
    const Component = await SurveyInactive({ status: "link invalid" });
    render(Component);

    expect(screen.getByTestId("help-icon")).toBeInTheDocument();
    expect(screen.getByText("common.survey link invalid.")).toBeInTheDocument();
    expect(screen.getByText("s.link_invalid")).toBeInTheDocument();
    expect(screen.queryByTestId("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
  });

  test("renders response submitted status correctly", async () => {
    const Component = await SurveyInactive({ status: "response submitted" });
    render(Component);

    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.getByText("common.survey response submitted.")).toBeInTheDocument();
    expect(screen.getByText("s.response_submitted")).toBeInTheDocument();
    expect(screen.queryByTestId("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
  });

  test("renders scheduled status correctly", async () => {
    const Component = await SurveyInactive({ status: "scheduled" });
    render(Component);

    expect(screen.getByText("common.survey scheduled.")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
  });

  test("shows branding when linkSurveyBranding is true", async () => {
    const Component = await SurveyInactive({ status: "paused", project: { linkSurveyBranding: true } });
    render(Component);
    expect(screen.getByTestId("mock-image")).toBeInTheDocument();
    expect(screen.getByTestId("footer-link")).toBeInTheDocument();
    expect(screen.getByTestId("footer-link")).toHaveAttribute("href", "https://formbricks.com");
  });

  test("hides branding when linkSurveyBranding is false", async () => {
    const Component = await SurveyInactive({ status: "paused", project: { linkSurveyBranding: false } });
    render(Component);
    expect(screen.queryByTestId("mock-image")).not.toBeInTheDocument();
    expect(screen.queryByTestId("footer-link")).not.toBeInTheDocument();
  });
});
