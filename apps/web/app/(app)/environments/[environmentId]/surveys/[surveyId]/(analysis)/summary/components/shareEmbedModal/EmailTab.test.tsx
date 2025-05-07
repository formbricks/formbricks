import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { getEmailHtmlAction, sendEmbedSurveyPreviewEmailAction } from "../../actions";
import { EmailTab } from "./EmailTab";

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
  Button: ({ children, onClick, variant, title, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} title={title} {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: ({ children, language }: { children: React.ReactNode; language: string }) => (
    <div data-testid="code-block" data-language={language}>
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
  MailIcon: () => <div data-testid="mail-icon" />,
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
    expect(screen.getByRole("button", { name: "send preview email" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.surveys.summary.view_embed_code_for_email" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(screen.getByTestId("code2-icon")).toBeInTheDocument();

    // Email preview section
    await waitFor(() => {
      expect(screen.getByText(`To : ${userEmail}`)).toBeInTheDocument();
    });
    expect(
      screen.getByText("Subject : environments.surveys.summary.formbricks_email_survey_preview")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Hello World ?preview=true&foo=bar")).toBeInTheDocument(); // Raw HTML content
    });
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument();
  });

  test("toggles embed code view", async () => {
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.summary.view_embed_code_for_email",
    });
    await userEvent.click(viewEmbedButton);

    // Embed code view
    expect(screen.getByRole("button", { name: "Embed survey in your website" })).toBeInTheDocument(); // Updated name
    expect(
      screen.getByRole("button", { name: "environments.surveys.summary.view_embed_code_for_email" }) // Updated name for hide button
    ).toBeInTheDocument();
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveTextContent(mockCleanedEmailHtml); // Cleaned HTML
    expect(screen.queryByText(`To : ${userEmail}`)).not.toBeInTheDocument();

    // Toggle back
    const hideEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.summary.view_embed_code_for_email", // Updated name for hide button
    });
    await userEvent.click(hideEmbedButton);

    expect(screen.getByRole("button", { name: "send preview email" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.surveys.summary.view_embed_code_for_email" })
    ).toBeInTheDocument();
    expect(screen.getByText(`To : ${userEmail}`)).toBeInTheDocument();
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument();
  });

  test("copies code to clipboard", async () => {
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.summary.view_embed_code_for_email",
    });
    await userEvent.click(viewEmbedButton);

    // Ensure this line queries by the correct aria-label
    const copyCodeButton = screen.getByRole("button", { name: "Embed survey in your website" });
    await userEvent.click(copyCodeButton);

    expect(mockWriteText).toHaveBeenCalledWith(mockCleanedEmailHtml);
    expect(toast.success).toHaveBeenCalledWith("environments.surveys.summary.embed_code_copied_to_clipboard");
  });

  test("sends preview email successfully", async () => {
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockResolvedValue({ data: true });
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", { name: "send preview email" });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    expect(toast.success).toHaveBeenCalledWith("environments.surveys.summary.email_sent");
  });

  test("handles send preview email failure (server error)", async () => {
    const errorResponse = { serverError: "Server issue" };
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockResolvedValue(errorResponse as any);
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", { name: "send preview email" });
    await userEvent.click(sendPreviewButton);

    expect(sendEmbedSurveyPreviewEmailAction).toHaveBeenCalledWith({ surveyId });
    expect(getFormattedErrorMessage).toHaveBeenCalledWith(errorResponse);
    expect(toast.error).toHaveBeenCalledWith("Server issue");
  });

  test("handles send preview email failure (authentication error)", async () => {
    vi.mocked(sendEmbedSurveyPreviewEmailAction).mockRejectedValue(new AuthenticationError("Auth failed"));
    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const sendPreviewButton = screen.getByRole("button", { name: "send preview email" });
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

    const sendPreviewButton = screen.getByRole("button", { name: "send preview email" });
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
      expect(screen.getByText("To : user@mail.com")).toBeInTheDocument();
    });
  });

  test("emailHtml memo removes various ?preview=true patterns", async () => {
    const htmlWithVariants =
      "<p>Test1 ?preview=true</p><p>Test2 ?preview=true&amp;next</p><p>Test3 ?preview=true&;next</p>";
    // Ensure this line matches the "Received" output from your test error
    const expectedCleanHtml = "<p>Test1 </p><p>Test2 ?next</p><p>Test3 ?next</p>";
    vi.mocked(getEmailHtmlAction).mockResolvedValue({ data: htmlWithVariants });

    render(<EmailTab surveyId={surveyId} email={userEmail} />);
    await waitFor(() => expect(vi.mocked(getEmailHtmlAction)).toHaveBeenCalled());

    const viewEmbedButton = screen.getByRole("button", {
      name: "environments.surveys.summary.view_embed_code_for_email",
    });
    await userEvent.click(viewEmbedButton);

    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toHaveTextContent(expectedCleanHtml);
  });
});
