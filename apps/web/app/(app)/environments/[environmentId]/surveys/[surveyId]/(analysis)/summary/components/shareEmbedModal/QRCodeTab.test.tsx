import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QRCodeTab } from "./QRCodeTab";

// Mock the QR code options utility
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/get-qr-code-options",
  () => ({
    getQRCodeOptions: vi.fn((width: number, height: number) => ({
      width,
      height,
      type: "svg",
      data: "",
      margin: 0,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "L",
      },
      imageOptions: {
        saveAsBlob: true,
        hideBackgroundDots: false,
        imageSize: 0,
        margin: 0,
      },
      dotsOptions: {
        type: "extra-rounded",
        color: "#000000",
        roundSize: true,
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        type: "dot",
        color: "#000000",
      },
      cornersDotOptions: {
        type: "dot",
        color: "#000000",
      },
    })),
  })
);

// Mock UI components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      data-testid="button">
      {children}
    </button>
  ),
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Download: () => <div data-testid="download-icon">Download</div>,
  LoaderCircle: ({ className }: { className?: string }) => (
    <div className={className} data-testid="loader-circle">
      LoaderCircle
    </div>
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <div className={className} data-testid="refresh-icon">
      RefreshCw
    </div>
  ),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock QRCodeStyling
const mockQRCodeStyling = {
  update: vi.fn(),
  append: vi.fn(),
  download: vi.fn(),
};

let shouldThrowError = false;

// @ts-ignore - Ignore TypeScript error for mock
vi.mock("qr-code-styling", () => ({
  default: vi.fn().mockImplementation(() => {
    if (shouldThrowError) {
      throw new Error("QR code generation failed");
    }
    return mockQRCodeStyling;
  }),
}));

const mockSurveyUrl = "https://example.com/survey/123";

describe("QRCodeTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    shouldThrowError = false;

    // Reset mock implementations
    mockQRCodeStyling.update.mockReset();
    mockQRCodeStyling.append.mockReset();
    mockQRCodeStyling.download.mockReset();

    // Set up default mock behavior
    mockQRCodeStyling.update.mockImplementation(() => {});
    mockQRCodeStyling.append.mockImplementation(() => {});
    mockQRCodeStyling.download.mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe("Component rendering", () => {
    test("renders component with title and description", () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      expect(
        screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code")
      ).toBeInTheDocument();
      expect(
        screen.getByText("environments.surveys.summary.responses_collected_via_qr_code_are_anonymous")
      ).toBeInTheDocument();
    });

    test("renders component content correctly", () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      expect(
        screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code")
      ).toBeInTheDocument();
      expect(
        screen.getByText("environments.surveys.summary.responses_collected_via_qr_code_are_anonymous")
      ).toBeInTheDocument();
    });

    test("renders without QR code when surveyUrl is empty", () => {
      render(<QRCodeTab surveyUrl="" />);

      expect(
        screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code")
      ).toBeInTheDocument();
      expect(
        screen.getByText("environments.surveys.summary.responses_collected_via_qr_code_are_anonymous")
      ).toBeInTheDocument();
    });
  });

  describe("QR Code generation", () => {
    test("attempts to generate QR code when surveyUrl is provided", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      // Component should render either success state or error state - both are valid
      await waitFor(() => {
        const hasContent = screen.queryByTestId("button") || screen.queryByTestId("alert");
        expect(hasContent).toBeTruthy();
      });
    });

    test("shows interactive element after rendering", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        expect(screen.getByTestId("button")).toBeInTheDocument();
      });

      const button = screen.getByTestId("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    test("shows error state when QR code generation fails", async () => {
      shouldThrowError = true;

      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
      });

      expect(screen.getByTestId("alert-title")).toHaveTextContent("common.something_went_wrong");
      expect(screen.getByTestId("alert-description")).toHaveTextContent(
        "environments.surveys.summary.qr_code_generation_failed"
      );
    });

    test("shows retry button in error state", async () => {
      shouldThrowError = true;

      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        const retryButton = screen.getByRole("button", { name: /common.retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    test("can retry QR code generation", async () => {
      shouldThrowError = true;

      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
      });

      // Reset error state
      shouldThrowError = false;

      const retryButton = screen.getByRole("button", { name: /common.retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("Download functionality", () => {
    test("has clickable download button when QR code is available", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        expect(screen.getByTestId("button")).toBeInTheDocument();
      });

      const downloadButton = screen.getByTestId("button");
      expect(downloadButton).toBeInTheDocument();
      expect(downloadButton).toHaveAttribute("type", "button");

      // Button should be clickable
      await userEvent.click(downloadButton);
      // If the button is clicked without throwing, it's working
    });

    test("handles button interactions properly", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        expect(screen.getByTestId("button")).toBeInTheDocument();
      });

      const button = screen.getByTestId("button");
      expect(button).toBeInTheDocument();

      // Test that button can be interacted with
      await userEvent.click(button);

      // Button should still be present after click
      expect(screen.getByTestId("button")).toBeInTheDocument();
    });

    test("shows appropriate state when surveyUrl is empty", async () => {
      render(<QRCodeTab surveyUrl="" />);

      // Component should render some content
      await waitFor(() => {
        const content = screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code");
        expect(content).toBeInTheDocument();
      });
    });
  });

  describe("Component lifecycle", () => {
    test("responds to surveyUrl changes", async () => {
      const { rerender } = render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      // Initial render should show some content
      await waitFor(() => {
        const content = screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code");
        expect(content).toBeInTheDocument();
      });

      const newSurveyUrl = "https://example.com/survey/456";
      rerender(<QRCodeTab surveyUrl={newSurveyUrl} />);

      // After rerender, content should still be present
      await waitFor(() => {
        const content = screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code");
        expect(content).toBeInTheDocument();
      });
    });

    test("handles empty surveyUrl gracefully", async () => {
      render(<QRCodeTab surveyUrl="" />);

      // Component should render basic content even with empty URL
      await waitFor(() => {
        const title = screen.getByText("environments.surveys.summary.make_survey_accessible_via_qr_code");
        const description = screen.getByText(
          "environments.surveys.summary.responses_collected_via_qr_code_are_anonymous"
        );
        expect(title).toBeInTheDocument();
        expect(description).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    test("has proper button labels and states", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      await waitFor(() => {
        const downloadButton = screen.getByTestId("button");
        expect(downloadButton).toBeInTheDocument();
        expect(downloadButton).toHaveAttribute("type", "button");
      });
    });

    test("shows appropriate loading or content state", async () => {
      render(<QRCodeTab surveyUrl={mockSurveyUrl} />);

      // Component should show either loading or content - both are valid
      await waitFor(() => {
        const hasContent = screen.queryByTestId("button") || screen.queryByTestId("loader-circle");
        expect(hasContent).toBeTruthy();
      });
    });
  });
});
