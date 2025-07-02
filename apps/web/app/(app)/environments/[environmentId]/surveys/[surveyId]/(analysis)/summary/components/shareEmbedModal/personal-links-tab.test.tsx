import { generatePersonalLinksAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PersonalLinksTab } from "./personal-links-tab";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions", () => ({
  generatePersonalLinksAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertButton: ({ children }: any) => <div data-testid="alert-button">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
  AlertTitle: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, loading, className, ...props }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-loading={loading}
      className={className}
      {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/date-picker", () => ({
  DatePicker: ({ date, updateSurveyDate, minDate, onClearDate }: any) => (
    <div data-testid="date-picker">
      <input
        data-testid="date-input"
        type="date"
        value={date ? date.toISOString().split("T")[0] : ""}
        onChange={(e) => {
          const newDate = e.target.value ? new Date(e.target.value) : null;
          updateSurveyDate(newDate);
        }}
      />
      <button data-testid="clear-date" onClick={() => onClearDate()}>
        Clear
      </button>
      <div data-testid="min-date">{minDate ? minDate.toISOString() : ""}</div>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/select", () => {
  let globalOnValueChange: ((value: string) => void) | null = null;

  return {
    Select: ({ children, value, onValueChange, disabled }: any) => {
      globalOnValueChange = onValueChange;
      return (
        <div data-testid="select" data-disabled={disabled} data-value={value}>
          <div data-testid="select-current-value">{value || "Select option"}</div>
          {children}
        </div>
      );
    },
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: any) => (
      <div
        data-testid="select-item"
        data-value={value}
        onClick={() => {
          if (globalOnValueChange) {
            globalOnValueChange(value);
          }
        }}>
        {children}
      </div>
    ),
    SelectTrigger: ({ children, className }: any) => (
      <div data-testid="select-trigger" className={className}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
  };
});

// Mock icons
vi.mock("lucide-react", () => ({
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
  DownloadIcon: () => <div data-testid="download-icon" />,
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href, target, rel }: any) => (
    <a data-testid="link" href={href} target={target} rel={rel}>
      {children}
    </a>
  ),
}));

const mockGeneratePersonalLinksAction = vi.mocked(generatePersonalLinksAction);
const mockToast = vi.mocked(toast);
const mockGetFormattedErrorMessage = vi.mocked(getFormattedErrorMessage);

// Mock segments data
const mockSegments = [
  {
    id: "segment1",
    title: "Public Segment 1",
    isPrivate: false,
    description: "Test segment 1",
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    surveys: [],
  },
  {
    id: "segment2",
    title: "Public Segment 2",
    isPrivate: false,
    description: "Test segment 2",
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    surveys: [],
  },
  {
    id: "segment3",
    title: "Private Segment",
    isPrivate: true,
    description: "Test private segment",
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    surveys: [],
  },
];

const defaultProps = {
  environmentId: "test-env-id",
  surveyId: "test-survey-id",
  segments: mockSegments,
};

// Helper function to trigger select change
const selectOption = (value: string) => {
  const selectItems = screen.getAllByTestId("select-item");
  const targetItem = selectItems.find((item) => item.getAttribute("data-value") === value);
  if (targetItem) {
    fireEvent.click(targetItem);
  }
};

describe("PersonalLinksTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the component with correct title and description", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    expect(
      screen.getByText("environments.surveys.summary.generate_personal_links_title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.generate_personal_links_description")
    ).toBeInTheDocument();
  });

  test("renders recipients section with segment selection", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    expect(screen.getByText("common.recipients")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.create_and_manage_segments")).toBeInTheDocument();
  });

  test("renders expiry date section with date picker", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    expect(screen.getByText("environments.surveys.summary.expiry_date_optional")).toBeInTheDocument();
    expect(screen.getByTestId("date-picker")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.expiry_date_description")).toBeInTheDocument();
  });

  test("renders generate button with correct initial state", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const button = screen.getByTestId("button");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(screen.getByText("environments.surveys.summary.generate_and_download_links")).toBeInTheDocument();
    expect(screen.getByTestId("download-icon")).toBeInTheDocument();
  });

  test("renders info alert with correct content", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.personal_links_work_with_segments")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.to_create_personal_links_segment_required")
    ).toBeInTheDocument();
    expect(screen.getByTestId("link")).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting#segment-configuration"
    );
  });

  test("filters out private segments and shows only public segments", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const selectItems = screen.getAllByTestId("select-item");
    expect(selectItems).toHaveLength(2); // Only public segments
    expect(selectItems[0]).toHaveTextContent("Public Segment 1");
    expect(selectItems[1]).toHaveTextContent("Public Segment 2");
  });

  test("shows no segments message when no public segments available", () => {
    const propsWithPrivateSegments = {
      ...defaultProps,
      segments: [mockSegments[2]], // Only private segment
    };

    render(<PersonalLinksTab {...propsWithPrivateSegments} />);

    expect(screen.getByText("environments.surveys.summary.no_segments_available")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  test("enables button when segment is selected", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    // Initially disabled
    expect(screen.getByTestId("button")).toBeDisabled();

    // Select a segment
    selectOption("segment1");

    // Should now be enabled
    expect(screen.getByTestId("button")).not.toBeDisabled();
  });

  test("handles date selection correctly", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const dateInput = screen.getByTestId("date-input");
    const testDate = "2024-12-31";

    fireEvent.change(dateInput, { target: { value: testDate } });

    expect(dateInput).toHaveValue(testDate);
  });

  test("clears date when clear button is clicked", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const dateInput = screen.getByTestId("date-input");
    const clearButton = screen.getByTestId("clear-date");

    // Set a date first
    fireEvent.change(dateInput, { target: { value: "2024-12-31" } });

    // Clear the date
    fireEvent.click(clearButton);

    expect(dateInput).toHaveValue("");
  });

  test("sets minimum date to tomorrow", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const minDateElement = screen.getByTestId("min-date");
    // Should have some ISO date string for a future date
    expect(minDateElement.textContent).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test("successfully generates and downloads links", async () => {
    const mockResult = {
      data: {
        downloadUrl: "https://example.com/download/file.csv",
        fileName: "personal-links.csv",
        count: 5,
      },
    };
    mockGeneratePersonalLinksAction.mockResolvedValue(mockResult);

    render(<PersonalLinksTab {...defaultProps} />);

    // Select a segment
    selectOption("segment1");

    // Click generate button
    const generateButton = screen.getByTestId("button");
    fireEvent.click(generateButton);

    // Verify action was called
    await waitFor(() => {
      expect(mockGeneratePersonalLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        segmentId: "segment1",
        environmentId: "test-env-id",
        expirationDays: undefined,
      });
    });

    // Verify loading toast
    expect(mockToast.loading).toHaveBeenCalledWith("environments.surveys.summary.generating_links_toast", {
      duration: 5000,
      id: "generating-links",
    });
  });

  test("generates links with expiry date when date is selected", async () => {
    const mockResult = {
      data: {
        downloadUrl: "https://example.com/download/file.csv",
        fileName: "personal-links.csv",
        count: 3,
      },
    };
    mockGeneratePersonalLinksAction.mockResolvedValue(mockResult);

    render(<PersonalLinksTab {...defaultProps} />);

    // Select a segment
    selectOption("segment1");

    // Set expiry date (10 days from now)
    const dateInput = screen.getByTestId("date-input");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const expiryDate = futureDate.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: expiryDate } });

    // Click generate button
    const generateButton = screen.getByTestId("button");
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockGeneratePersonalLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        segmentId: "segment1",
        environmentId: "test-env-id",
        expirationDays: expect.any(Number),
      });
    });

    // Verify that expirationDays is a reasonable value (between 9-10 days)
    const callArgs = mockGeneratePersonalLinksAction.mock.calls[0][0];
    expect(callArgs.expirationDays).toBeGreaterThanOrEqual(9);
    expect(callArgs.expirationDays).toBeLessThanOrEqual(10);
  });

  test("handles error response from generatePersonalLinksAction", async () => {
    const mockErrorResult = {
      serverError: "Test error message",
    };
    mockGeneratePersonalLinksAction.mockResolvedValue(mockErrorResult);
    mockGetFormattedErrorMessage.mockReturnValue("Formatted error message");

    render(<PersonalLinksTab {...defaultProps} />);

    // Select a segment
    selectOption("segment1");

    // Click generate button
    const generateButton = screen.getByTestId("button");
    fireEvent.click(generateButton);

    // Wait for the action to be called
    await waitFor(() => {
      expect(mockGeneratePersonalLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        segmentId: "segment1",
        environmentId: "test-env-id",
        expirationDays: undefined,
      });
    });

    // Wait for error handling
    await waitFor(() => {
      expect(mockGetFormattedErrorMessage).toHaveBeenCalledWith(mockErrorResult);
      expect(mockToast.error).toHaveBeenCalledWith("Formatted error message", {
        duration: 5000,
        id: "generating-links",
      });
    });
  });

  test("shows generating state when triggered", async () => {
    // Mock a promise that resolves quickly
    const mockResult = { data: { downloadUrl: "test", fileName: "test.csv", count: 1 } };
    mockGeneratePersonalLinksAction.mockResolvedValue(mockResult);

    render(<PersonalLinksTab {...defaultProps} />);

    // Select a segment
    selectOption("segment1");

    // Click generate button
    const generateButton = screen.getByTestId("button");
    fireEvent.click(generateButton);

    // Verify loading toast is called
    expect(mockToast.loading).toHaveBeenCalledWith("environments.surveys.summary.generating_links_toast", {
      duration: 5000,
      id: "generating-links",
    });
  });

  test("button is disabled when no segment is selected", () => {
    render(<PersonalLinksTab {...defaultProps} />);

    const generateButton = screen.getByTestId("button");
    expect(generateButton).toBeDisabled();
  });

  test("button is disabled when no public segments are available", () => {
    const propsWithNoPublicSegments = {
      ...defaultProps,
      segments: [mockSegments[2]], // Only private segments
    };

    render(<PersonalLinksTab {...propsWithNoPublicSegments} />);

    const generateButton = screen.getByTestId("button");
    expect(generateButton).toBeDisabled();
  });

  test("handles empty segments array", () => {
    const propsWithEmptySegments = {
      ...defaultProps,
      segments: [],
    };

    render(<PersonalLinksTab {...propsWithEmptySegments} />);

    expect(screen.getByText("environments.surveys.summary.no_segments_available")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  test("calculates expiration days correctly for different dates", async () => {
    const mockResult = {
      data: {
        downloadUrl: "https://example.com/download/file.csv",
        fileName: "test.csv",
        count: 1,
      },
    };
    mockGeneratePersonalLinksAction.mockResolvedValue(mockResult);

    render(<PersonalLinksTab {...defaultProps} />);

    // Select a segment
    selectOption("segment1");

    // Set expiry date to 5 days from now
    const dateInput = screen.getByTestId("date-input");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const expiryDate = futureDate.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: expiryDate } });

    // Click generate button
    const generateButton = screen.getByTestId("button");
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockGeneratePersonalLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        segmentId: "segment1",
        environmentId: "test-env-id",
        expirationDays: expect.any(Number),
      });
    });

    // Verify that expirationDays is a reasonable value (between 4-5 days)
    const callArgs = mockGeneratePersonalLinksAction.mock.calls[0][0];
    expect(callArgs.expirationDays).toBeGreaterThanOrEqual(4);
    expect(callArgs.expirationDays).toBeLessThanOrEqual(5);
  });
});
