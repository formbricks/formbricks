import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";
import { EmailTab } from "./email-tab";

// Mock actions
vi.mock("../../actions", () => ({
  getEmailHtmlAction: vi.fn(),
  sendEmbedSurveyPreviewEmailAction: vi.fn(),
}));

// Mock helper
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((val) => val?.serverError || "Formatted error message"),
}));

// Mock UI components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, title, "aria-label": ariaLabel, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} title={title} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: ({
    children,
    language,
    showCopyToClipboard,
  }: {
    children: React.ReactNode;
    language: string;
    showCopyToClipboard?: boolean;
  }) => (
    <div data-testid="code-block" data-language={language} data-show-copy={showCopyToClipboard}>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/loading-spinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">LoadingSpinner</div>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Code2Icon: () => <div data-testid="code2-icon" />,
  CopyIcon: () => <div data-testid="copy-icon" />,
  EyeIcon: () => <div data-testid="eye-icon" />,
  MailIcon: () => <div data-testid="mail-icon" />,
  SendIcon: () => <div data-testid="send-icon" />,
}));

// Mock navigator.clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  configurable: true,
});

const surveyId = "test-survey-id";
const userEmail = "test@example.com";
const mockEmailHtmlPreview = "<p>Hello World ?preview=true&amp;foo=bar</p>";
const mockCleanedEmailHtml = "<p>Hello World ?foo=bar</p>";

describe("EmailTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmailHtmlAction).mockResolvedValue({ data: mockEmailHtmlPreview });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders initial state correctly and fetches email HTML", async () => {
    render(<EmailTab surveyId={surveyId} email={userEmail} />);

    expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalledWith({ surveyId });

    // Buttons
    expect(
      screen.getByRole("button", { name: "environments.surveys.share.send_email.send_preview_email" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.surveys.share.send_email.embed_code_tab" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("send-icon")).toBeInTheDocument();
    // Note: code2-icon is only visible in the embed code tab, not in initial render

    // Email preview section
    await waitFor(() => {
      const emailToElements = screen.getAllByText((content, element) => {
        return (
          element?.textContent?.includes("environments.surveys.share.send_email.email_to_label") || false
        );
      });
      expect(emailToElements.length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.textContent?.includes("environments.surveys.share.send_email.email_subject_label") || false
        );
      }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.textContent?.includes(
            "environments.surveys.share.send_email.formbricks_email_survey_preview"
          ) || false
        );
      }).length
    ).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText("Hello World ?foo=bar")).toBeInTheDocument(); // HTML content rendered as text (preview=true removed)
    });
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument();
  });

  test("toggles embed code view", async () => {
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.embed_code_tab",
    });
    await userEvent.click(viewEmbedButton);

    // Embed code view
    expect(
      screen.getByRole("button", { name: "environments.surveys.share.send_email.copy_embed_code" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveTextContent(mockCleanedEmailHtml); // Cleaned HTML
    // The email_to_label should not be visible in embed code view
    expect(
      screen.queryByText((content, element) => {
        return (
          element?.textContent?.includes("environments.surveys.share.send_email.email_to_label") || false
        );
      })
    ).not.toBeInTheDocument();

    // Toggle back to preview
    const previewButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.email_preview_tab",
    });
    await userEvent.click(previewButton);

    expect(
      screen.getByRole("button", { name: "environments.surveys.share.send_email.send_preview_email" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.surveys.share.send_email.embed_code_tab" })
    ).toBeInTheDocument();
    await waitFor(() => {
      const emailToElements = screen.getAllByText((content, element) => {
        return (
          element?.textContent?.includes("environments.surveys.share.send_email.email_to_label") || false
        );
      });
      expect(emailToElements.length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument();
  });

  test("copies code to clipboard", async () => {
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.embed_code_tab",
    });
    await userEvent.click(viewEmbedButton);

    const copyCodeButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.copy_embed_code",
    });
    await userEvent.click(copyCodeButton);

    expect(mockWriteText).toHaveBeenCalledWith(mockCleanedEmailHtml);
    expect(toast.success).toHaveBeenCalledWith(
      "environments.surveys.share.send_email.embed_code_copied_to_clipboard"
    );
  });

  test("sends preview email successfully", async () => {
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockResolvedValue({ data: true });
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.send_preview_email",
    });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    expect(toast.success).toHaveBeenCalledWith("environments.surveys.share.send_email.email_sent");
  });

  test("handles send preview email failure (server error)", async () => {
    const errorResponse = { serverError: "Server issue" };
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockResolvedValue(errorResponse as any);
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.send_preview_email",
    });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    expect(getFormattedErrorMessage).toHaveBeenCalledWith(errorResponse);
    expect(toast.error).toHaveBeenCalledWith("Server issue");
  });

  test("handles send preview email failure (authentication error)", async () => {
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockRejectedValue(new AuthenticationError("Auth failed"));
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.send_preview_email",
    });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("common.not_authenticated");
    });
  });

  test("handles send preview email failure (generic error)", async () => {
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockRejectedValue(new Error("Generic error"));
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.send_preview_email",
    });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong_please_try_again");
    });
  });

  test("renders loading spinner if email HTML is not yet fetched", () => {
    vi.mocked(getEmailHtmlAction).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  test("renders default email if email prop is not provided", async () => {
    render(<EmailTab surveyId={surveyId} email="" />);
    await waitFor(() => {
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent === "environments.surveys.share.send_email.email_to_label : user@mail.com"
          );
        })
      ).toBeInTheDocument();
    });
  });

  test("emailHtml memo removes various ?preview=true patterns", async () => {
    const htmlWithVariants =
      "<p>Test1 ?preview=true</p><p>Test2 ?preview=true&amp;next</p><p>Test3 ?preview=true&;next</p>";
    const expectedCleanHtml = "<p>Test1 </p><p>Test2 ?next</p><p>Test3 ?next</p>";
    vi.mocked(getEmailHtmlAction).mockResolvedValue({ data: htmlWithVariants });

    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.share.send_email.embed_code_tab",
    });
    await userEvent.click(viewEmbedButton);

    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toHaveTextContent(expectedCleanHtml);
  });
});
