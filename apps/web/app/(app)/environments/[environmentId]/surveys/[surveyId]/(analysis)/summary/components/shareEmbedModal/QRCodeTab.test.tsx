import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QRCodeTab } from "./QRCodeTab";

// Mock qr-code-styling
const mockQRCodeStyling = vi.fn().mockImplementation(() => ({
  update: vi.fn(),
  append: vi.fn(),
  download: vi.fn(),
}));

vi.mock("qr-code-styling", () => ({
  default: mockQRCodeStyling,
}));

// Mock getQRCodeOptions
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/get-qr-code-options",
  () => ({
    getQRCodeOptions: vi.fn().mockReturnValue({
      width: 280,
      height: 280,
      type: "svg",
      data: "",
    }),
  })
);

// Mock react-hot-toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

// Mock Tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (str: string) => str,
  }),
}));

// Mock DOM manipulation
const mockDiv = {
  innerHTML: "",
  appendChild: vi.fn(),
};

describe("QRCodeTab", () => {
  const mockSurveyUrl = "https://example.com/s/survey123";
  let mockQRInstance: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockToast.success.mockClear();
    mockToast.error.mockClear();

    // Create mock QR instance
    mockQRInstance = {
      update: vi.fn(),
      append: vi.fn(),
      download: vi.fn(),
    };
    mockQRCodeStyling.mockReturnValue(mockQRInstance);

    // Mock document.createElement
    global.document.createElement = vi.fn().mockReturnValue(mockDiv);
    global.document.body.appendChild = vi.fn();
    global.document.body.removeChild = vi.fn();

    // Mock console.error to avoid noise in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders QR code tab with correct title and description", () => {
    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    expect(
      screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.responses_collected_via_qr_code_are_anonymous")
    ).toBeInTheDocument();
  });

  test("shows loading state initially", () => {
    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    expect(screen.getByText("environments.surveys.summary.generating_qr_code")).toBeInTheDocument();
  });

  test("generates QR code when survey URL is provided", async () => {
    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    await waitFor(() => {
      expect(mockQRCodeStyling).toHaveBeenCalledWith({
        width: 280,
        height: 280,
        type: "svg",
        data: "",
      });
      expect(mockQRInstance.update).toHaveBeenCalledWith({ data: mockSurveyUrl });
      expect(mockQRInstance.append).toHaveBeenCalled();
    });
  });

  test("shows error state when QR code generation fails", async () => {
    mockQRInstance.update.mockImplementation(() => {
      throw new Error("QR code generation failed");
    });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    await waitFor(() => {
      expect(screen.getByText("environments.surveys.summary.qr_code_generation_failed")).toBeInTheDocument();
      expect(screen.getByText("common.retry")).toBeInTheDocument();
    });
  });

  test("downloads QR code when download button is clicked", async () => {
    const user = userEvent.setup();
    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    // Wait for QR code to be generated
    await waitFor(() => {
      expect(mockQRInstance.append).toHaveBeenCalled();
    });

    const downloadButton = screen.getByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });

    await user.click(downloadButton);

    expect(mockQRCodeStyling).toHaveBeenCalledWith({
      width: 280,
      height: 280,
      type: "svg",
      data: "",
    });
    expect(mockQRInstance.download).toHaveBeenCalledWith({
      name: "survey-qr-code",
      extension: "png",
    });
    expect(mockToast.success).toHaveBeenCalledWith("environments.surveys.summary.qr_code_download_started");
  });

  test("shows loading state while downloading", async () => {
    const user = userEvent.setup();

    // Mock download to be slow
    mockQRInstance.download.mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    // Wait for QR code to be generated
    await waitFor(() => {
      expect(mockQRInstance.append).toHaveBeenCalled();
    });

    const downloadButton = screen.getByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });

    await user.click(downloadButton);

    expect(screen.getByText("environments.surveys.summary.downloading_qr_code")).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();
  });

  test("shows error toast when download fails", async () => {
    const user = userEvent.setup();
    mockQRInstance.download.mockImplementation(() => {
      throw new Error("Download failed");
    });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    // Wait for QR code to be generated
    await waitFor(() => {
      expect(mockQRInstance.append).toHaveBeenCalled();
    });

    const downloadButton = screen.getByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });

    await user.click(downloadButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("environments.surveys.summary.qr_code_download_failed");
    });
  });

  test("retry button regenerates QR code", async () => {
    const user = userEvent.setup();

    // Make initial generation fail
    mockQRInstance.update.mockImplementationOnce(() => {
      throw new Error("QR code generation failed");
    });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    await waitFor(() => {
      expect(screen.getByText("environments.surveys.summary.qr_code_generation_failed")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /common.retry/i });

    // Make retry succeed
    mockQRInstance.update.mockImplementation(() => {});

    await user.click(retryButton);

    // Should show loading state again
    expect(screen.getByText("environments.surveys.summary.generating_qr_code")).toBeInTheDocument();
  });

  test("download button is disabled when no survey URL", () => {
    render(<QRCodeTab surveyUrl="" />);

    const downloadButton = screen.getByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });

    expect(downloadButton).toBeDisabled();
  });

  test("download button is disabled when in error state", async () => {
    mockQRInstance.update.mockImplementation(() => {
      throw new Error("QR code generation failed");
    });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    await waitFor(() => {
      expect(screen.getByText("environments.surveys.summary.qr_code_generation_failed")).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });

    expect(downloadButton).toBeDisabled();
  });

  test("clears previous QR code content before rendering new one", async () => {
    const mockQRCodeRef = { innerHTML: "previous content", appendChild: vi.fn() };
    vi.spyOn(require("react"), "useRef").mockReturnValue({ current: mockQRCodeRef });

    render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

    await waitFor(() => {
      expect(mockQRCodeRef.innerHTML).toBe("");
      expect(mockQRInstance.append).toHaveBeenCalledWith(mockQRCodeRef);
    });
  });

  test("does not generate QR code when survey URL is empty", () => {
    render(<QRCodeTab surveyUrl="" />);

    expect(mockQRCodeStyling).not.toHaveBeenCalled();
    expect(mockQRInstance.update).not.toHaveBeenCalled();
  });
});
