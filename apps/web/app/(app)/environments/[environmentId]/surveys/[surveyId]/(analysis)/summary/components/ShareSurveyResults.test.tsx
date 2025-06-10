import { ShareSurveyResults } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareSurveyResults";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock Button
vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, onClick, asChild, ...props }: any) => {
    if (asChild) {
      // For 'asChild', Button renders its children, potentially passing props via Slot.
      // Mocking simply renders children inside a div that can receive Button's props.
      return <div {...props}>{children}</div>;
    }
    return (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    );
  }),
}));

// Mock Dialog
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: vi.fn(({ children, open, onOpenChange }) =>
    open ? (
      <div data-testid="dialog" role="dialog">
        {children}
        <button onClick={() => onOpenChange(false)}>Close Dialog</button>
      </div>
    ) : null
  ),
  DialogContent: vi.fn(({ children, ...props }) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  )),
  DialogBody: vi.fn(({ children }) => <div data-testid="dialog-body">{children}</div>),
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

// Mock Next Link
vi.mock("next/link", () => ({
  default: vi.fn(({ children, href, target, rel, ...props }) => (
    <a href={href} target={target} rel={rel} {...props}>
      {children}
    </a>
  )),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSetOpen = vi.fn();
const mockHandlePublish = vi.fn();
const mockHandleUnpublish = vi.fn();
const surveyUrl = "https://app.formbricks.com/s/some-survey-id";

const defaultProps = {
  open: true,
  setOpen: mockSetOpen,
  handlePublish: mockHandlePublish,
  handleUnpublish: mockHandleUnpublish,
  showPublishModal: false,
  surveyUrl: "",
};

describe("ShareSurveyResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.defineProperty(global.navigator, "clipboard", {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders publish warning when showPublishModal is false", async () => {
    render(<ShareSurveyResults {...defaultProps} />);
    expect(screen.getByText("environments.surveys.summary.publish_to_web_warning")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.publish_to_web_warning_description")
    ).toBeInTheDocument();
    const publishButton = screen.getByText("environments.surveys.summary.publish_to_web");
    expect(publishButton).toBeInTheDocument();
    await userEvent.click(publishButton);
    expect(mockHandlePublish).toHaveBeenCalledTimes(1);
  });

  test("renders survey public info when showPublishModal is true and surveyUrl is provided", async () => {
    render(<ShareSurveyResults {...defaultProps} showPublishModal={true} surveyUrl={surveyUrl} />);
    expect(screen.getByText("environments.surveys.summary.survey_results_are_public")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.survey_results_are_shared_with_anyone_who_has_the_link")
    ).toBeInTheDocument();
    expect(screen.getByText(surveyUrl)).toBeInTheDocument();

    const copyButton = screen.getByRole("button", { name: "Copy survey link to clipboard" });
    expect(copyButton).toBeInTheDocument();
    await userEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(surveyUrl);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("common.link_copied");

    const unpublishButton = screen.getByText("environments.surveys.summary.unpublish_from_web");
    expect(unpublishButton).toBeInTheDocument();
    await userEvent.click(unpublishButton);
    expect(mockHandleUnpublish).toHaveBeenCalledTimes(1);

    const viewSiteLink = screen.getByText("environments.surveys.summary.view_site");
    expect(viewSiteLink).toBeInTheDocument();
    const anchor = viewSiteLink.closest("a");
    expect(anchor).toHaveAttribute("href", surveyUrl);
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("does not render content when modal is closed (open is false)", () => {
    render(<ShareSurveyResults {...defaultProps} open={false} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.publish_to_web_warning")).not.toBeInTheDocument();
    expect(
      screen.queryByText("environments.surveys.summary.survey_results_are_public")
    ).not.toBeInTheDocument();
  });

  test("renders publish warning if surveyUrl is empty even if showPublishModal is true", () => {
    render(<ShareSurveyResults {...defaultProps} showPublishModal={true} surveyUrl="" />);
    expect(screen.getByText("environments.surveys.summary.publish_to_web_warning")).toBeInTheDocument();
    expect(
      screen.queryByText("environments.surveys.summary.survey_results_are_public")
    ).not.toBeInTheDocument();
  });
});
