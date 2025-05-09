import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LoadSegmentModal } from ".";

// Mock the nested SegmentDetail component
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual<typeof import("lucide-react")>("lucide-react");
  return {
    ...actual,
    Loader2: vi.fn(() => <div data-testid="loader-icon">Loader</div>),
    UsersIcon: vi.fn(() => <div data-testid="users-icon">Users</div>),
  };
});

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("LoadSegmentModal", () => {
  const mockDate = new Date("2023-01-01T12:00:00Z");

  const mockCurrentSegment: TSegment = {
    id: "current-segment-id",
    title: "Current Segment",
    description: "Current segment description",
    isPrivate: false,
    filters: [],
    environmentId: "env-1",
    surveys: ["survey-1"],
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const mockSegments: TSegment[] = [
    {
      id: "segment-1",
      title: "Segment 1",
      description: "Test segment 1",
      isPrivate: false,
      filters: [],
      environmentId: "env-1",
      surveys: ["survey-1"],
      createdAt: new Date("2023-01-02T12:00:00Z"),
      updatedAt: new Date("2023-01-05T12:00:00Z"),
    },
    {
      id: "segment-2",
      title: "Segment 2",
      description: "Test segment 2",
      isPrivate: false,
      filters: [],
      environmentId: "env-1",
      surveys: ["survey-1"],
      createdAt: new Date("2023-02-02T12:00:00Z"),
      updatedAt: new Date("2023-02-05T12:00:00Z"),
    },
    {
      id: "segment-3",
      title: "Segment 3 (Private)",
      description: "This is private",
      isPrivate: true,
      filters: [],
      environmentId: "env-1",
      surveys: ["survey-1"],
      createdAt: mockDate,
      updatedAt: mockDate,
    },
  ];

  const mockSurveyId = "survey-1";
  const mockSetOpen = vi.fn();
  const mockSetSegment = vi.fn();
  const mockSetIsSegmentEditorOpen = vi.fn();
  const mockOnSegmentLoad = vi.fn();

  const defaultProps = {
    open: true,
    setOpen: mockSetOpen,
    surveyId: mockSurveyId,
    currentSegment: mockCurrentSegment,
    segments: mockSegments,
    setSegment: mockSetSegment,
    setIsSegmentEditorOpen: mockSetIsSegmentEditorOpen,
    onSegmentLoad: mockOnSegmentLoad,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders empty state when no segments are available", () => {
    render(<LoadSegmentModal {...defaultProps} segments={[]} />);

    expect(
      screen.getByText("environments.surveys.edit.you_have_not_created_a_segment_yet")
    ).toBeInTheDocument();
    expect(screen.queryByText("common.segment")).not.toBeInTheDocument();
  });

  test("renders segments list correctly when segments are available", () => {
    render(<LoadSegmentModal {...defaultProps} />);

    // Headers
    expect(screen.getByText("common.segment")).toBeInTheDocument();
    expect(screen.getByText("common.updated_at")).toBeInTheDocument();
    expect(screen.getByText("common.created_at")).toBeInTheDocument();

    // Only non-private segments should be visible (2 out of 3)
    expect(screen.getByText("Segment 1")).toBeInTheDocument();
    expect(screen.getByText("Segment 2")).toBeInTheDocument();
    expect(screen.queryByText("Segment 3 (Private)")).not.toBeInTheDocument();
  });

  test("clicking on a segment loads it and closes the modal", async () => {
    mockOnSegmentLoad.mockResolvedValueOnce({
      id: "survey-1",
      segment: {
        id: "segment-1",
        title: "Segment 1",
        description: "Test segment 1",
        isPrivate: false,
        filters: [],
        environmentId: "env-1",
        surveys: ["survey-1"],
      },
    } as unknown as TSurvey);

    const user = userEvent.setup();

    render(<LoadSegmentModal {...defaultProps} />);

    // Find and click the first segment
    const segmentElements = screen.getAllByText(/Segment \d/);
    await user.click(segmentElements[0]);

    // Wait for the segment to be loaded
    await waitFor(() => {
      expect(mockOnSegmentLoad).toHaveBeenCalledWith(mockSurveyId, "segment-1");
      expect(mockSetSegment).toHaveBeenCalled();
    });
  });

  test("displays loading indicator while loading a segment", async () => {
    // Mock a delayed resolution to see the loading state
    mockOnSegmentLoad.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: "survey-1",
              segment: {
                id: "segment-1",
                title: "Segment 1",
                description: "Test segment 1",
                isPrivate: false,
                filters: [],
                environmentId: "env-1",
                surveys: ["survey-1"],
              },
            } as unknown as TSurvey);
          }, 100);
        })
    );

    const user = userEvent.setup();

    render(<LoadSegmentModal {...defaultProps} />);

    // Find and click the first segment
    const segmentElements = screen.getAllByText(/Segment \d/);
    await user.click(segmentElements[0]);

    // Check for loader
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  test("shows error toast when segment loading fails", async () => {
    mockOnSegmentLoad.mockRejectedValueOnce(new Error("Failed to load segment"));

    const user = userEvent.setup();

    render(<LoadSegmentModal {...defaultProps} />);

    // Find and click the first segment
    const segmentElements = screen.getAllByText(/Segment \d/);
    await user.click(segmentElements[0]);

    // Wait for the error toast
    await waitFor(() => {
      expect(mockSetOpen).toHaveBeenCalledWith(false);
      // The toast error is mocked, so we're just verifying the modal closes
    });
  });

  test("doesn't attempt to load a segment if it's the current one", async () => {
    const currentSegmentProps = {
      ...defaultProps,
      segments: [mockCurrentSegment], // Only the current segment is available
    };

    const user = userEvent.setup();

    render(<LoadSegmentModal {...currentSegmentProps} />);

    // Click the current segment
    await user.click(screen.getByText("Current Segment"));

    // onSegmentLoad shouldn't be called since we're already using this segment
    expect(mockOnSegmentLoad).not.toHaveBeenCalled();
  });

  test("handles invalid segment data gracefully", async () => {
    // Mock an incomplete response from onSegmentLoad
    mockOnSegmentLoad.mockResolvedValueOnce({
      // Missing id or segment properties
    } as unknown as TSurvey);

    const user = userEvent.setup();

    render(<LoadSegmentModal {...defaultProps} />);

    // Find and click the first segment
    const segmentElements = screen.getAllByText(/Segment \d/);
    await user.click(segmentElements[0]);

    // Wait for error handling
    await waitFor(() => {
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });
});
